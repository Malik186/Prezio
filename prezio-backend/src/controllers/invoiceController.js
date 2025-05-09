const asyncHandler = require('express-async-handler');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const QRCode = require('qrcode');
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const User = require('../models/User');
const Template = require('../models/Template');
const generateInvoiceNumber = require('../utils/generateInvoiceNumber');
const sendInvoiceEmail = require('../utils/sendInvoiceEmail');
const { createInvoiceEmail } = require('../utils/emailTemplates');

exports.createInvoice = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const {
    dueDate,
    client: clientId,
    lineItems,
    currency,
    invoiceName,
    projectDescription,
    notes,
    discount = 0,
    template: templateId,
    payment,
    quotation: quotationId
  } = req.body;

  if (!clientId || !lineItems?.length || !dueDate || !currency || !invoiceName || !projectDescription || !notes || !templateId || !payment) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // Validate payment details
  if (!validatePaymentDetails(payment)) {
    return res.status(400).json({ message: 'Invalid payment details' });
  }

  const [client, user] = await Promise.all([
    Client.findOne({ _id: clientId, user: userId }),
    User.findById(userId)
  ]);

  // Validate Template exists
  const template = await Template.findById(templateId);
  if (!template) return res.status(404).json({ message: 'Selected Template not found' });

  if (!client) return res.status(404).json({ message: 'Client not found' });
  if (!user) return res.status(404).json({ message: 'User not found' });

  const nextNumber = (user.lastInvoiceNumber || 0) + 1;
  const invoiceNumber = generateInvoiceNumber(nextNumber);
  user.lastInvoiceNumber = nextNumber;
  await user.save();

  let subtotal = 0;
  let tax = 0;

  lineItems.forEach(item => {
    const lineTotal = item.quantity * item.unitPrice;
    subtotal += lineTotal;
    // Always apply VAT tax (16%)
    tax += lineTotal * 0.16;
  });

  const total = subtotal + tax - discount;

  // Create the invoice object
  const invoiceData = {
    invoiceNumber,
    invoiceName,
    projectDescription,
    notes,
    dueDate,
    client: client._id,
    creator: user._id,
    currency,
    lineItems,
    subtotal,
    tax,
    total,
    discount,
    status: 'draft',
    template: template._id,
    payment,
    clientSnapshot: {
      name: client.clientName,
      address: client.clientAddress,
      contactPhone: client.contactPersonPhone,
      contactEmail: client.contactPersonEmail
    },
    creatorSnapshot: {
      companyName: user.companyName || '',
      position: user.position || '',
      firstName: user.firstName || '',
      middleName: user.middleName || '',
      surname: user.surname || '',
      logo: {
        url: user.logo?.url || '',
        public_id: user.logo?.public_id || ''
      },
      email: user.email,
      phone: user.phone || '',
      address: user.address || '',
      invoiceTerms: user.invoiceTerms || ''
    }
  };

  // If created from quotation, link it
  if (quotationId) {
    invoiceData.quotation = quotationId;
  }

  const invoice = await Invoice.create(invoiceData);

  res.status(201).json({ message: '✅ Invoice created successfully', invoice });
});

// Validate payment details helper function
function validatePaymentDetails(payment) {
  if (!payment || !payment.method) return false;
  
  if (payment.method === 'mpesa') {
    if (!payment.mpesa || !payment.mpesa.type) return false;
    
    if (payment.mpesa.type === 'paybill') {
      return payment.mpesa.paybill && payment.mpesa.paybill.tillNumber;
    } else if (payment.mpesa.type === 'sendMoney') {
      return payment.mpesa.sendMoney && payment.mpesa.sendMoney.phoneNumber;
    }
    return false;
  } else if (payment.method === 'bank') {
    return payment.bank && payment.bank.bankName && payment.bank.accountNumber;
  }
  
  return false;
}

//
// Register helpers for Handlebars
Handlebars.registerHelper('multiply', function (a, b) {
  return Number(a) * Number(b);
});

// Register other useful helpers
Handlebars.registerHelper('formatCurrency', function (value, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD'
  }).format(value);
});

Handlebars.registerHelper('formatDate', function (date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// QR Code generator helper function
const generateQRCode = async (url) => {
  try {
    // Using QRCode.toDataURL from qrcode library
    return await QRCode.toDataURL(url, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: 'M'
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return null;
  }
};

// Updated preview controller for optimized client-side PDF generation with pagination
exports.previewInvoice = asyncHandler(async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('template')
      .populate('client')
      .populate('quotation');

    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    // Using the same path resolution approach as in templateController
    const templatePath = path.resolve(process.cwd(), 'src', 'templates', invoice.template.fileName);

    // Check if template file exists
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({
        message: 'Template file not found',
        path: templatePath
      });
    }

    const templateHtml = fs.readFileSync(templatePath, 'utf-8');

    // Configure Handlebars with allowProtoProperties to address the warning
    const compiled = Handlebars.compile(templateHtml);

    // Convert Mongoose documents to plain JavaScript objects
    const plainInvoice = invoice.toObject ? invoice.toObject() : JSON.parse(JSON.stringify(invoice));

    // Generate QR code for the invoice if frontend URL is provided
    const frontendBaseUrl = process.env.FRONTEND_URL || 'https://yourapp.com';
    const invoiceUrl = `${frontendBaseUrl}/invoices/view/${plainInvoice._id}`;
    const invoiceQrCode = await generateQRCode(invoiceUrl);

    // Set up pagination for line items (10 items per page)
    const ITEMS_PER_PAGE = 10;
    const lineItems = plainInvoice.lineItems.map(item => ({ ...item })); // Create plain objects
    const totalPages = Math.ceil(lineItems.length / ITEMS_PER_PAGE);

    // Organize items into pages
    const pages = [];
    for (let i = 0; i < totalPages; i++) {
      const startIdx = i * ITEMS_PER_PAGE;
      const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, lineItems.length);
      pages.push({
        items: lineItems.slice(startIdx, endIdx),
        isLastPage: i === totalPages - 1
      });
    }

    // Format payment details for display
    const paymentDetails = getFormattedPaymentDetails(plainInvoice.payment);

    // Prepare the data for the template with properly converted objects
    const templateData = {
      invoice: plainInvoice,
      client: plainInvoice.clientSnapshot,
      user: plainInvoice.creatorSnapshot,
      pages: pages,
      totalPages: totalPages,
      invoiceQrCode: invoiceQrCode,
      subtotal: plainInvoice.subtotal,
      tax: plainInvoice.tax,
      total: plainInvoice.total,
      discount: plainInvoice.discount,
      invoiceName: plainInvoice.invoiceName,
      projectDescription: plainInvoice.projectDescription,
      notes: plainInvoice.notes,
      currency: plainInvoice.currency,
      dueDate: plainInvoice.dueDate,
      payment: paymentDetails,
      // Include metadata for PDF generation
      meta: {
        title: `Invoice for ${plainInvoice.clientSnapshot.name}`,
        fileName: `Invoice-${plainInvoice.invoiceNumber}.pdf`
      }
    };

    // Generate HTML with optimizations for PDF conversion
    let html = compiled(templateData);

    // Optionally add PDF-specific styles or script to the HTML
    // These will only be used for the PDF generation
    const pdfStyles = `
      <style>
        @page {
          margin: 15mm;
          size: A4;
        }
        body {
          font-family: 'Helvetica', 'Arial', sans-serif;
          color: #333;
          line-height: 1.5;
        }
        /* Additional PDF-specific styles */
        @media print {
          .no-print {
            display: none;
          }
          table { page-break-inside: avoid; }
          h2, h3 { page-break-after: avoid; }
          .page { page-break-after: always; }
          .page:last-child { page-break-after: auto; }
        }
      </style>
    `;

    // Inject PDF-specific styles before closing </head> tag
    html = html.replace('</head>', `${pdfStyles}</head>`);

    // Add PDF generation script if requested in query parameters
    if (req.query.includePdfScript === 'true') {
      const pdfScript = `
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
        <script>
          // Auto-generate PDF when loaded
          window.onload = function() {
            const options = {
              margin: 10,
              filename: '${templateData.meta.fileName}',
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { scale: 2, useCORS: true },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
              pagebreak: { mode: 'avoid-all', before: '.page' }
            };
            html2pdf().from(document.body).set(options).save();
          };
        </script>
      `;
      html = html.replace('</body>', `${pdfScript}</body>`);
    }

    // Set appropriate headers for browser rendering
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error previewing invoice:', error);
    res.status(500).json({
      message: 'Error generating invoice preview',
      error: error.message
    });
  }
});

// Helper to format payment details for display
function getFormattedPaymentDetails(payment) {
  if (!payment) return { method: 'Not specified' };

  const result = { method: payment.method };
  
  if (payment.method === 'mpesa') {
    result.type = payment.mpesa.type;
    
    if (payment.mpesa.type === 'paybill') {
      result.details = `Till Number: ${payment.mpesa.paybill.tillNumber}`;
    } else if (payment.mpesa.type === 'sendMoney') {
      result.details = `Phone Number: ${payment.mpesa.sendMoney.phoneNumber}`;
    }
  } else if (payment.method === 'bank') {
    result.details = `Bank: ${payment.bank.bankName}, Account: ${payment.bank.accountNumber}`;
  }
  
  result.status = payment.status;
  
  if (payment.datePaid) {
    result.datePaid = new Date(payment.datePaid).toLocaleDateString();
  }
  
  return result;
}

// POST /api/invoices/:id/send
// Send invoice to client via email
exports.sendInvoice = asyncHandler(async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Verify the invoice belongs to the current user
    if (!invoice.creator.equals(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to send this invoice' });
    }

    // Use the email stored in the invoice's clientSnapshot
    const clientEmail = invoice.clientSnapshot.contactEmail;
    if (!clientEmail) {
      return res.status(400).json({ message: 'Client email not found in invoice' });
    }

    // Generate invoice URL (same as used for QR code)
    const frontendBaseUrl = process.env.FRONTEND_URL || 'https://prezio.com';
    const invoiceUrl = `${frontendBaseUrl}/invoices/view/${invoiceId}`;

    // Create email subject with invoice name and company
    const emailSubject = `Invoice: ${invoice.invoiceName} from ${invoice.creatorSnapshot.companyName}`;

    // Using sendInvoiceEmail utility
    await sendInvoiceEmail({
      to: clientEmail,
      subject: emailSubject,
      html: createInvoiceEmail(invoice, invoiceUrl)
    });

    // Update invoice status to 'sent' if it was in 'draft'
    if (invoice.status === 'draft') {
      invoice.status = 'sent';
      invoice.sentAt = new Date();
      await invoice.save();
    }

    res.status(200).json({
      success: true,
      message: `✅ Invoice sent successfully to ${clientEmail}`
    });
  } catch (error) {
    console.error('Error sending invoice email:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending invoice email',
      error: error.message
    });
  }
});

// Update Invoice Payment Status
exports.updateInvoicePaymentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, amountPaid, datePaid } = req.body;

  // Validate input
  if (!['pending', 'partial', 'paid', 'overdue', 'canceled'].includes(status)) {
    return res.status(400).json({ 
      message: '❌ Invalid status. Must be "pending", "partial", "paid", "overdue", or "canceled".' 
    });
  }

  const invoice = await Invoice.findById(id);

  if (!invoice || invoice.isDeleted) {
    return res.status(404).json({ message: '❌ Invoice not found.' });
  }

  // Update invoice payment details
  invoice.payment.status = status;
  
  if (amountPaid !== undefined) {
    invoice.payment.amountPaid = amountPaid;
  }
  
  if (datePaid) {
    invoice.payment.datePaid = datePaid;
  }
  
  // Also update main status to reflect payment status
  invoice.status = status;
  
  await invoice.save();

  res.status(200).json({ 
    message: `✅ Invoice payment status updated to ${status} successfully.`, 
    invoice 
  });
});

// GET /api/invoices?status=&search=&page=&limit=
exports.getInvoices = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, search } = req.query;
  const userId = req.user._id;

  const query = {
    creator: userId,
    isDeleted: { $ne: true } // Exclude soft-deleted invoices
  };

  if (status) {
    query.status = status;
  }

  if (search) {
    query.$or = [
      { invoiceName: new RegExp(search, 'i') },
      { invoiceNumber: new RegExp(search, 'i') },
      { 'clientSnapshot.name': new RegExp(search, 'i') }
    ];
  }

  const total = await Invoice.countDocuments(query);
  const invoices = await Invoice.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.json({
    total,
    page: Number(page),
    limit: Number(limit),
    invoices
  });
});

// GET /api/invoices/overdue
exports.getOverdueInvoices = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const today = new Date();

  const query = {
    creator: userId,
    dueDate: { $lt: today },
    status: { $nin: ['paid', 'canceled'] },
    isDeleted: { $ne: true }
  };

  const overdueInvoices = await Invoice.find(query)
    .sort({ dueDate: 1 });

  res.status(200).json({
    count: overdueInvoices.length,
    invoices: overdueInvoices
  });
});

// GET /api/invoices/:id
exports.getInvoiceById = asyncHandler(async (req, res) => {
  const invoiceId = req.params.id;
  const userId = req.user._id;

  const invoice = await Invoice.findOne({
    _id: invoiceId,
    creator: userId,
    isDeleted: { $ne: true }
  }).populate('quotation', 'quoteNumber quoteName');

  if (!invoice) {
    return res.status(404).json({ message: 'Invoice not found' });
  }

  res.status(200).json(invoice);
});

// PUT /api/invoices/:id
exports.editInvoice = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const invoiceId = req.params.id;

  const invoice = await Invoice.findOne({
    _id: invoiceId,
    creator: userId,
    isDeleted: { $ne: true }
  });

  if (!invoice) {
    return res.status(404).json({ message: 'Invoice not found' });
  }

  // Update allowed fields
  const updatableFields = ['invoiceName', 'dueDate', 'lineItems', 'discount', 'currency', 'payment', 'notes', 'projectDescription'];
  
  updatableFields.forEach(field => {
    if (req.body[field] !== undefined) {
      if (field === 'payment' && req.body.payment) {
        // For payment, we need to validate the structure
        if (validatePaymentDetails(req.body.payment)) {
          invoice[field] = req.body[field];
        }
      } else {
        invoice[field] = req.body[field];
      }
    }
  });

  // Recalculate totals if line items or discount changed
  if (req.body.lineItems || req.body.discount !== undefined) {
    let subtotal = 0;
    let tax = 0;

    invoice.lineItems.forEach(item => {
      const lineTotal = item.quantity * item.unitPrice;
      subtotal += lineTotal;
      // Always apply VAT tax (16%)
      tax += lineTotal * 0.16;
    });

    invoice.subtotal = subtotal;
    invoice.tax = tax;
    invoice.total = subtotal + tax - invoice.discount;
  }

  await invoice.save();
  res.status(200).json({ message: '✅ Invoice updated successfully', invoice });
});

// DELETE /api/invoices/:id
exports.softDeleteInvoice = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const invoiceId = req.params.id;

  const invoice = await Invoice.findOne({
    _id: invoiceId,
    creator: userId,
    isDeleted: { $ne: true }
  });

  if (!invoice) {
    return res.status(404).json({ message: 'Invoice not found' });
  }

  invoice.isDeleted = true;
  invoice.deletedAt = new Date();
  await invoice.save();

  res.status(200).json({ message: '🗑️ Invoice soft-deleted successfully' });
});

// GET /api/invoices/trash?search=&page=&limit=
exports.getSoftDeletedInvoices = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search } = req.query;
  const userId = req.user._id;

  const query = {
    creator: userId,
    isDeleted: true // Only get soft-deleted invoices
  };

  if (search) {
    query.$or = [
      { invoiceName: new RegExp(search, 'i') },
      { invoiceNumber: new RegExp(search, 'i') },
      { 'clientDetails.clientName': new RegExp(search, 'i') }
    ];
  }

  const total = await Invoice.countDocuments(query);
  const invoices = await Invoice.find(query)
    .sort({ deletedAt: -1 }) // Sort by deletion date
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.json({
    total,
    page: Number(page),
    limit: Number(limit),
    invoices
  });
});

// PUT /api/invoices/:id/restore
exports.restoreInvoice = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const invoiceId = req.params.id;

  const invoice = await Invoice.findOne({
    _id: invoiceId,
    creator: userId,
    isDeleted: true
  });

  if (!invoice) {
    return res.status(404).json({ message: 'Deleted invoice not found' });
  }

  invoice.isDeleted = false;
  invoice.deletedAt = null;
  await invoice.save();

  res.status(200).json({ message: '♻️ Invoice restored successfully', invoice });
});

// POST /api/invoices/create-from-quotation/:quotationId
exports.createInvoiceFromQuotation = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const quotationId = req.params.quotationId;
  const { payment, dueDate } = req.body;

  if (!payment || !dueDate) {
    return res.status(400).json({ message: 'Payment details and due date are required' });
  }

  // Validate payment details
  if (!validatePaymentDetails(payment)) {
    return res.status(400).json({ message: 'Invalid payment details' });
  }

  const quotation = await Quotation.findOne({
    _id: quotationId,
    creator: userId,
    isDeleted: { $ne: true }
  });

  if (!quotation) {
    return res.status(404).json({ message: 'Quotation not found' });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Generate new invoice number
  const nextNumber = (user.lastInvoiceNumber || 0) + 1;
  const invoiceNumber = generateInvoiceNumber(nextNumber);
  user.lastInvoiceNumber = nextNumber;
  await user.save();

  // Create invoice from quotation data
  const invoiceData = {
    invoiceNumber,
    invoiceName: `Invoice for ${quotation.quoteName}`,
    projectDescription: quotation.projectDescription,
    notes: quotation.notes,
    dueDate,
    client: quotation.client,
    creator: userId,
    currency: quotation.currency,
    lineItems: quotation.lineItems.map(item => ({
      ...item,
      // Remove applyTax property if it exists
      ...(item.applyTax && { applyTax: undefined })
    })),
    subtotal: quotation.subtotal,
    // Recalculate tax to always apply VAT
    tax: quotation.lineItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice * 0.16), 0),
    discount: quotation.discount,
    status: 'draft',
    template: quotation.template,
    payment,
    quotation: quotation._id,
    clientSnapshot: quotation.clientSnapshot,
    creatorSnapshot: {
      ...quotation.creatorSnapshot,
      // Change quoteTerms to invoiceTerms if applicable
      invoiceTerms: user.invoiceTerms || quotation.creatorSnapshot.quoteTerms || ''
    }
  };

  // Calculate the total with VAT always applied
  invoiceData.total = invoiceData.subtotal + invoiceData.tax - invoiceData.discount;

  const invoice = await Invoice.create(invoiceData);

  res.status(201).json({ 
    message: '✅ Invoice created successfully from quotation', 
    invoice 
  });
});