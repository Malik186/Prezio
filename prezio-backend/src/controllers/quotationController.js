const asyncHandler = require('express-async-handler');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const QRCode = require('qrcode');
const Quotation = require('../models/Quotation');
const Client = require('../models/Client');
const User = require('../models/User');
const Template = require('../models/Template');
const generateQuoteNumber = require('../utils/generateQuoteNumber');
const generateInvoiceNumber = require('../utils/generateInvoiceNumber');
const sendQuotationEmail = require('../utils/sendQuotationEmail');
const sendInvoiceEmail = require('../utils/sendInvoiceEmail');
const Invoice = require('../models/Invoice');
const { sendNotification } = require('../services/notificationService');
const { createQuotationEmail } = require('../utils/emailTemplates');
const { createInvoiceEmail } = require('../utils/emailTemplates');

exports.createQuotation = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const {
    validUntil,
    client: clientId,
    lineItems,
    currency,
    quoteName,
    projectDescription,
    notes,
    discount = 0,
    template: templateId
  } = req.body;

  if (!clientId || !lineItems?.length || !validUntil || !currency || !quoteName || !projectDescription  || !notes || !templateId) {
    return res.status(400).json({ message: 'Missing required fields' });
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

  const nextNumber = (user.lastQuoteNumber || 0) + 1;
  const quoteNumber = generateQuoteNumber(nextNumber);
  user.lastQuoteNumber = nextNumber;
  await user.save();

  // Notification of successful creation
  await sendNotification({
    userId: user._id,
    title: 'Quotation Created',
    body: `Quotation ${quoteName} has been created successfully.`,
    type: 'success'
  });

  let subtotal = 0;
  let tax = 0;

  lineItems.forEach(item => {
    const lineTotal = item.quantity * item.unitPrice;
    subtotal += lineTotal;
    if (item.applyTax) tax += lineTotal * 0.16;
  });

  const total = subtotal + tax - discount;

  const quotation = await Quotation.create({
    quoteNumber,
    quoteName,
    projectDescription,
    notes,
    validUntil,
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
      quoteTerms: user.quoteTerms || ''
    }
  });

  res.status(201).json({ message: '✅ Quotation created successfully', quotation });
});

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
exports.previewQuotation = asyncHandler(async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('template')
      .populate('client');

    if (!quotation) return res.status(404).json({ message: 'Quotation not found' });

    // Fetch template from Cloudinary
    if (!quotation.template.fileUrl) {
      return res.status(404).json({
        message: 'Template URL not found'
      });
    }

    let templateHtml;
    try {
      templateHtml = await getTemplateFromCloudinary(quotation.template.fileUrl);
    } catch (error) {
      return res.status(404).json({
        message: 'Error fetching template',
        error: error.message
      });
    }

    // Configure Handlebars with allowProtoProperties to address the warning
    const compiled = Handlebars.compile(templateHtml);

    // Convert Mongoose documents to plain JavaScript objects
    const plainQuotation = quotation.toObject ? quotation.toObject() : JSON.parse(JSON.stringify(quotation));

    // Generate QR code for the quotation if frontend URL is provided
    const frontendBaseUrl = process.env.FRONTEND_URL || 'https://yourapp.com';
    const quotationUrl = `${frontendBaseUrl}/quotations/view/${plainQuotation._id}`;
    const quotationQrCode = await generateQRCode(quotationUrl);

    // Set up pagination for line items (10 items per page)
    const ITEMS_PER_PAGE = 10;
    const lineItems = plainQuotation.lineItems.map(item => ({ ...item })); // Create plain objects
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

    // Prepare the data for the template with properly converted objects
    const templateData = {
      quotation: plainQuotation,
      client: plainQuotation.clientSnapshot,
      user: plainQuotation.creatorSnapshot,
      pages: pages,
      totalPages: totalPages,
      quotationQrCode: quotationQrCode,
      subtotal: plainQuotation.subtotal,
      tax: plainQuotation.tax,
      total: plainQuotation.total,
      discount: plainQuotation.discount,
      quoteName: plainQuotation.quoteName,
      projectDescription: plainQuotation.projectDescription,
      notes: plainQuotation.notes,
      currency: plainQuotation.currency,
      validUntil: plainQuotation.validUntil,
      // Include metadata for PDF generation
      meta: {
        title: `Quotation for ${plainQuotation.clientSnapshot.name}`,
        fileName: `Quotation-${plainQuotation.quoteNumber}.pdf`
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
    console.error('Error previewing quotation:', error);
    res.status(500).json({
      message: 'Error generating quotation preview',
      error: error.message
    });
  }
});

// POST /api/quotations/:id/send
// Send quotation to client via email
exports.sendQuotation = asyncHandler(async (req, res) => {
  try {
    const quotationId = req.params.id;
    const quotation = await Quotation.findById(quotationId);

    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    // Verify the quotation belongs to the current user
    if (!quotation.creator.equals(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to send this quotation' });
    }

    // Use the email stored in the quotation's clientSnapshot
    const clientEmail = quotation.clientSnapshot.contactEmail;
    if (!clientEmail) {
      return res.status(400).json({ message: 'Client email not found in quotation' });
    }

    // Generate quotation URL (same as used for QR code)
    const frontendBaseUrl = process.env.FRONTEND_URL || 'https://prezio.com';
    const quotationUrl = `${frontendBaseUrl}/quotations/view/${quotationId}`;

    // Create email subject with quotation name and company
    const emailSubject = `Quotation: ${quotation.quoteName} from ${quotation.creatorSnapshot.companyName}`;

    // Using sendQuotationEmail utility
    await sendQuotationEmail({
      to: clientEmail,
      subject: emailSubject,
      html: createQuotationEmail(quotation, quotationUrl)
    });

    // Notification of successful sending
    await sendNotification({
      userId: req.user._id,
      title: 'Quotation Sent',
      body: `Quotation ${quotation.quoteName} has been sent successfully to ${clientEmail}.`,
      type: 'success'
    });

    // Update quotation status to 'sent' if it was in 'draft'
    if (quotation.status === 'draft') {
      quotation.status = 'sent';
      quotation.sentAt = new Date();
      await quotation.save();
    }

    res.status(200).json({
      success: true,
      message: `✅ Quotation sent successfully to ${clientEmail}`
    });
  } catch (error) {
    console.error('Error sending quotation email:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending quotation email',
      error: error.message
    });
  }
});

// Update Quotation Status (Accept/Reject)
exports.updateQuotationStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // expected 'accepted' or 'rejected'

  // Validate input
  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ message: '❌ Invalid status. Must be "accepted" or "rejected".' });
  }

  const quotation = await Quotation.findById(id).populate('creator client');

  if (!quotation || quotation.isDeleted) {
    return res.status(404).json({ message: '❌ Quotation not found.' });
  }

  // Only allow updating if current status is 'sent' 'draft' or 'viewed'
  if (!['sent', 'viewed', 'draft'].includes(quotation.status)) {
    return res.status(400).json({ message: `❌ Cannot change status from '${quotation.status}'.` });
  }

  quotation.status = status;
  await quotation.save();

  // Notification of status change
  await sendNotification({
    userId: user._id,
    title: 'Quotation Status Updated',
    body: `Quotation ${quotation.quoteName} has been ${status}.`,
    type: 'info'
  });

  // If quotation is accepted, generate an invoice automatically
  if (status === 'accepted') {
    try {
      // Create a due date 7 days from now (adjustable as needed)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
      
      //  TODO Create default payment details (this will need to be adjusted based on a user)
      const defaultPayment = {
        method: 'mpesa', // Default payment method
        mpesa: {
          type: 'paybill',
          paybill: {
            tillNumber: quotation.creator.defaultTillNumber || '123456' // Use creator's default tillNumber or a placeholder
          }
        },
        status: 'pending'
      };
      
      // Update lineItems structure for invoice
      // Remove applyTax property as it's not needed in invoice model
      const invoiceLineItems = quotation.lineItems.map(item => {
        const { applyTax, ...restItem } = item.toObject ? item.toObject() : item;
        return restItem;
      });

      // Calculate subtotal and tax for invoice (tax is applied to all items)
      let subtotal = 0;
      let tax = 0;

      invoiceLineItems.forEach(item => {
        const lineTotal = item.quantity * item.unitPrice;
        subtotal += lineTotal;
        tax += lineTotal * 0.16; // Always apply 16% tax
      });

      const total = subtotal + tax - (quotation.discount || 0);

      // Generate invoice number
      const user = quotation.creator;
      const nextNumber = (user.lastInvoiceNumber || 0) + 1;
      const invoiceNumber = generateInvoiceNumber(nextNumber);
      user.lastInvoiceNumber = nextNumber;
      await user.save();

      // Create the invoice
      const invoice = await Invoice.create({
        invoiceNumber,
        invoiceName: quotation.quoteName, // Use quotation name
        projectDescription: quotation.projectDescription,
        notes: quotation.notes,
        dueDate,
        client: quotation.client._id,
        creator: user._id,
        currency: quotation.currency,
        lineItems: invoiceLineItems,
        subtotal,
        tax,
        total,
        discount: quotation.discount || 0,
        status: 'draft',
        template: quotation.template, // Use the same template
        payment: defaultPayment,
        quotation: quotation._id, // Link to quotation
        clientSnapshot: quotation.clientSnapshot,
        creatorSnapshot: {
          ...quotation.creatorSnapshot,
          invoiceTerms: user.invoiceTerms || '' // Use invoiceTerms instead of quoteTerms
        }
      });

      // Send the invoice to client's email
      const frontendBaseUrl = process.env.FRONTEND_URL || 'https://prezio.com';
      const invoiceUrl = `${frontendBaseUrl}/invoices/view/${invoice._id}`;

      // Create email subject with invoice name and company
      const emailSubject = `Invoice: ${invoice.invoiceName} from ${invoice.creatorSnapshot.companyName}`;

      await sendInvoiceEmail({
        to: quotation.clientSnapshot.contactEmail,
        subject: emailSubject,
        html: createInvoiceEmail(invoice, invoiceUrl) //  TODO implement this function similar to createQuotationEmail
      });

      // Notification of successful invoice creation
      await sendNotification({
        userId: user._id,
        title: 'Invoice Created',
        body: `Invoice ${invoice.invoiceName} has been created and sent successfully.`,
        type: 'success'
      });

      // Update invoice status to 'sent'
      invoice.status = 'sent';
      await invoice.save();

      return res.status(200).json({ 
        message: `✅ Quotation ${status} successfully. Invoice created and sent.`, 
        quotation,
        invoice 
      });
    } catch (error) {
      console.error('Error generating invoice:', error);
      // Still update quotation status even if invoice creation fails
      return res.status(200).json({ 
        message: `✅ Quotation ${status} successfully, but automatic invoice creation failed: ${error.message}`,
        quotation
      });
    }
  }

  res.status(200).json({ message: `✅ Quotation ${status} successfully.`, quotation });
});

// GET /api/quotations?status=&search=&page=&limit=
exports.getQuotations = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, search } = req.query;
  const userId = req.user._id;

  const query = {
    creator: userId,
    isDeleted: { $ne: true } // Exclude soft-deleted quotations
  };

  if (status) {
    query.status = status;
  }

  if (search) {
    query.$or = [
      { quoteName: new RegExp(search, 'i') },
      { quoteNumber: new RegExp(search, 'i') },
      { 'clientDetails.clientName': new RegExp(search, 'i') }
    ];
  }

  const total = await Quotation.countDocuments(query);
  const quotations = await Quotation.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.json({
    total,
    page: Number(page),
    limit: Number(limit),
    quotations
  });
});

// PUT /api/quotations/:id
exports.editQuotation = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const quotationId = req.params.id;

  const quotation = await Quotation.findOne({
    _id: quotationId,
    creator: userId,
    isDeleted: { $ne: true }
  });

  if (!quotation) {
    return res.status(404).json({ message: 'Quotation not found' });
  }

  // Update allowed fields
  const updatableFields = ['quoteName', 'validUntil', 'lineItems', 'discount', 'currency', 'status'];
  updatableFields.forEach(field => {
    if (req.body[field] !== undefined) {
      quotation[field] = req.body[field];
    }
  });

  await quotation.save();

  // Notification of successful update
  await sendNotification({
    userId: userId,
    title: 'Quotation Updated',
    body: `Quotation ${quotation.quoteName} has been updated successfully.`,
    type: 'info'
  });

  res.status(200).json({ message: '✅ Quotation updated successfully', quotation });
});

// DELETE /api/quotations/:id
exports.softDeleteQuotation = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const quotationId = req.params.id;

  const quotation = await Quotation.findOne({
    _id: quotationId,
    creator: userId,
    isDeleted: { $ne: true }
  });

  if (!quotation) {
    return res.status(404).json({ message: 'Quotation not found' });
  }

  quotation.isDeleted = true;
  quotation.deletedAt = new Date();
  await quotation.save();

  // Notification of successful deletion
  await sendNotification({
    userId: userId,
    title: 'Quotation Deleted',
    body: `Quotation ${quotation.quoteName} has been deleted successfully.`,
    type: 'warning'
  });

  res.status(200).json({ message: '🗑️ Quotation soft-deleted successfully' });
});

// GET /api/quotations/trash?search=&page=&limit=
exports.getSoftDeletedQuotations = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search } = req.query;
  const userId = req.user._id;

  const query = {
    creator: userId,
    isDeleted: true // Only get soft-deleted quotations
  };

  if (search) {
    query.$or = [
      { quoteName: new RegExp(search, 'i') },
      { quoteNumber: new RegExp(search, 'i') },
      { 'clientDetails.clientName': new RegExp(search, 'i') }
    ];
  }

  const total = await Quotation.countDocuments(query);
  const quotations = await Quotation.find(query)
    .sort({ deletedAt: -1 }) // Sort by deletion date
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.json({
    total,
    page: Number(page),
    limit: Number(limit),
    quotations
  });
});

// PUT /api/quotations/:id/restore
exports.restoreQuotation = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const quotationId = req.params.id;

  const quotation = await Quotation.findOne({
    _id: quotationId,
    creator: userId,
    isDeleted: true
  });

  if (!quotation) {
    return res.status(404).json({ message: 'Deleted quotation not found' });
  }

  quotation.isDeleted = false;
  quotation.deletedAt = null;
  await quotation.save();
  
  // Notification of successful restoration
  await sendNotification({
    userId: userId,
    title: 'Quotation Restored',
    body: `Quotation ${quotation.quoteName} has been restored successfully.`,
    type: 'info'
  });

  res.status(200).json({ message: '♻️ Quotation restored successfully', quotation });
});

// List all quotations where validUntil date is expired
exports.getExpiredQuotations = asyncHandler(async (req, res) => {
  const today = new Date();

  const expiredQuotations = await Quotation.find({
    validUntil: { $lt: today },
    isDeleted: false
  }).populate('client', 'clientName') // optional: populate client name
    .populate('creator', 'companyName email'); // optional: populate creator info

  res.status(200).json({ count: expiredQuotations.length, quotations: expiredQuotations });
});