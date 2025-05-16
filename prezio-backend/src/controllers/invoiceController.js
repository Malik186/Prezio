const asyncHandler = require('express-async-handler');
const Handlebars = require('handlebars');
const QRCode = require('qrcode');
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const User = require('../models/User');
const Template = require('../models/Template');
const generateInvoiceNumber = require('../utils/generateInvoiceNumber');
const receiptController = require('./receiptController');
const sendInvoiceEmail = require('../utils/sendInvoiceEmail');
const logActivity = require('../utils/activityLogger');
const { sendNotification } = require('../services/notificationService');
const { createInvoiceEmail } = require('../utils/emailTemplates');
const { recordPaymentHistory } = require('../utils/paymentHistoryManager');

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

  await logActivity({
    user: user._id,
    action: 'CREATE_INVOICE',
    description: 'New invoice created',
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  // Notification of Successful invoice creation
  await sendNotification({
    userId: user._id,
    title: 'New Invoice Created',
    body: `A new invoice has been created for you. Invoice Number: ${invoiceNumber}`,
    type: 'success'
  });

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

  await logActivity({
    user: user._id,
    action: 'CREATE_INVOICE',
    description: 'Invoice created successfully from Quote',
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

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

// Fetch template url
async function getTemplateFromCloudinary(templateUrl) {
  try {
    const response = await fetch(templateUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch template');
    }
    return await response.text();
  } catch (error) {
    console.error('Error fetching template:', error);
    throw error;
  }
}

// Updated preview controller for optimized client-side PDF generation with pagination
exports.previewInvoice = asyncHandler(async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('template')
      .populate('client')
      .populate('quotation');

    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    // Fetch template from Cloudinary
    if (!invoice.template.fileUrl) {
      return res.status(404).json({
        message: 'Template URL not found'
      });
    }

    let templateHtml;
    try {
      templateHtml = await getTemplateFromCloudinary(invoice.template.fileUrl);
    } catch (error) {
      return res.status(404).json({
        message: 'Error fetching template',
        error: error.message
      });
    }

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

    await logActivity({
      user: user._id,
      action: 'SEND_INVOICE',
      description: 'Invoice sent to client',
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Using sendInvoiceEmail utility
    await sendInvoiceEmail({
      to: clientEmail,
      subject: emailSubject,
      html: createInvoiceEmail(invoice, invoiceUrl)
    });

    // Send notification for successful sending
    await sendNotification({
      userId: user._id,
      title: 'Invoice Sent',
      body: `Invoice ${invoice.invoiceName} has been sent to ${clientEmail}`,
      type: 'success'
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
  const { status, amountPaid, datePaid, paymentMethod, paymentDetails, notes, __v } = req.body;

  try {
    const invoice = await Invoice.findOne({
      _id: id,
      isDeleted: { $ne: true }
    });

    if (!invoice) {
      return res.status(404).json({
        message: '❌ Invoice not found'
      });
    }

    // Version check
    if (__v !== undefined && invoice.__v !== __v) {
      return res.status(409).json({
        message: `❌ Invoice "${invoice.invoiceName}" (${invoice.invoiceNumber}) has been modified. Please refresh and try again.`,
        currentVersion: invoice.__v,
        providedVersion: __v
      });
    }

    const currentStatus = invoice.payment?.status || 'pending';

    // Only allow manual status change to 'canceled' for 'sent' and 'draft' statuses
    if (status === 'canceled') {
      if (!['sent', 'draft', 'pending'].includes(currentStatus)) {
        return res.status(400).json({
          message: `❌ Cannot cancel Invoice "${invoice.invoiceName}" (${invoice.invoiceNumber}). Only invoices with 'sent' or 'draft' status can be cancelled.`
        });
      }
      // Update both invoice and payment status
      invoice.status = 'canceled';
      if (invoice.payment) {
        invoice.payment.status = 'canceled';
      }
      invoice.__v = (__v || 0) + 1;
      await invoice.save();

      // Send notification for cancellation
      await sendNotification({
        userId: user._id,
        title: 'Invoice Canceled',
        body: `Invoice "${invoice.invoiceName}" (${invoice.invoiceNumber}) has been canceled.`,
        type: 'warning'
      });

      return res.status(200).json({
        message: `✅ Invoice cancelled successfully`,
        invoice
      });
    }

    // If trying to change status manually (without payment)
    if (!amountPaid) {
      return res.status(400).json({
        message: `❌ Status can only be changed through payment or cancellation`
      });
    }

    // Handle payment updates
    if (amountPaid !== undefined) {
      // Validate payment amount
      if (amountPaid < 5 || amountPaid > 500000) {
        return res.status(400).json({
          message: `❌ Payment amount must be between 5 and 500,000 ${invoice.currency}`
        });
      }

      // Initialize payment object if it doesn't exist
      if (!invoice.payment) {
        invoice.payment = {
          method: paymentMethod || 'mpesa',
          status: 'pending',
          amountPaid: 0
        };
      }

      // Calculate total amount paid including current payment
      const totalPaidAmount = (invoice.payment.amountPaid || 0) + amountPaid;

      // Auto-determine status based on total amount paid
      if (totalPaidAmount >= invoice.total) {
        invoice.status = 'paid';
        invoice.payment.status = 'paid';
      } else if (totalPaidAmount >= 5) {
        invoice.status = 'partial';
        invoice.payment.status = 'partial';
      } else {
        return res.status(400).json({
          message: `❌ Payment amount must be at least 5 ${invoice.currency}`
        });
      }

      // Record payment history
      await recordPaymentHistory(invoice, {
        amountPaid,
        previousAmount: invoice.payment?.amountPaid || 0,
        paymentMethod: paymentMethod || invoice.payment.method,
        paymentDetails,
        notes,
        datePaid,
        userId: req.user._id
      });

      // Notification for payment
      await sendNotification({
        userId: user._id,
        title: 'Payment Recorded',
        body: `Payment of ${amountPaid} ${invoice.currency} received for Invoice "${invoice.invoiceName}" (${invoice.invoiceNumber}).`,
        type: 'success'
      });

      // Update payment details
      invoice.payment.amountPaid = totalPaidAmount;
      invoice.payment.method = paymentMethod || invoice.payment.method;
    }

    // Increment version and save
    invoice.__v = (__v || 0) + 1;
    await invoice.save();

    return res.status(200).json({
      message: `✅ Payment recorded successfully`,
      invoice
    });

  } catch (error) {
    console.error('Error updating invoice payment status:', error);
    res.status(500).json({
      message: '❌ Error updating invoice payment status',
      error: error.message
    });
  }
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
    return res.status(404).json({ message: '❌ Invoice not found' });
  }

  // Prevent editing paid invoices
  if (invoice.payment?.status === 'paid') {
    return res.status(400).json({
      message: '❌ Paid invoices cannot be modified'
    });
  }

  // For partial payments, only allow adding new line items
  if (invoice.payment?.status === 'partial') {
    // Only allow adding new line items
    if (req.body.lineItems) {
      const existingItemIds = invoice.lineItems.map(item => item._id.toString());
      const newLineItems = req.body.lineItems.filter(item => !item._id);

      // Ensure existing items haven't been modified
      const existingItemsUnchanged = req.body.lineItems
        .filter(item => item._id)
        .every(item => {
          const originalItem = invoice.lineItems.find(i => i._id.toString() === item._id);
          return originalItem &&
            originalItem.quantity === item.quantity &&
            originalItem.unitPrice === item.unitPrice &&
            originalItem.description === item.description;
        });

      if (!existingItemsUnchanged) {
        return res.status(400).json({
          message: '❌ Cannot modify existing line items for partially paid invoices'
        });
      }

      // Add only new items
      invoice.lineItems = [...invoice.lineItems, ...newLineItems];
    }

    // Prevent modifying other fields
    const allowedFieldsForPartial = ['lineItems'];
    const attemptedFields = Object.keys(req.body).filter(field => !allowedFieldsForPartial.includes(field));

    if (attemptedFields.length > 0) {
      return res.status(400).json({
        message: '❌ Only new line items can be added to partially paid invoices',
        attemptedFields
      });
    }
  } else {
    // For other statuses, allow normal editing
    const updatableFields = ['invoiceName', 'dueDate', 'lineItems', 'discount', 'currency', 'payment', 'notes', 'projectDescription'];

    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'payment' && req.body.payment) {
          if (validatePaymentDetails(req.body.payment)) {
            invoice[field] = req.body[field];
          }
        } else {
          invoice[field] = req.body[field];
        }
      }
    });
  }

  // Recalculate totals if new items were added
  if (req.body.lineItems) {
    let subtotal = 0;
    let tax = 0;

    invoice.lineItems.forEach(item => {
      const lineTotal = item.quantity * item.unitPrice;
      subtotal += lineTotal;
      tax += lineTotal * 0.16;
    });

    invoice.subtotal = subtotal;
    invoice.tax = tax;
    invoice.total = subtotal + tax - invoice.discount;
  }

  await invoice.save();

  await logActivity({
  user: user._id,
  action: 'UPDATE_INVOICE',
  description: 'Invoice updated',
  ip: req.ip,
  userAgent: req.headers['user-agent']
});

  // Send notification for successful update
  await sendNotification({
    userId: userId,
    title: 'Invoice Updated',
    body: `Invoice "${invoice.invoiceName}" (${invoice.invoiceNumber}) has been updated.`,
    type: 'info'
  });

  res.status(200).json({
    message: '✅ Invoice updated successfully',
    invoice
  });
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

  await logActivity({
  user: user._id,
  action: 'DELETE_INVOICE',
  description: 'Invoice soft-deleted',
  ip: req.ip,
  userAgent: req.headers['user-agent']
});

  // Send notification for successful deletion
  await sendNotification({
    userId: userId,
    title: 'Invoice Deleted',
    body: `Invoice "${invoice.invoiceName}" (${invoice.invoiceNumber}) has been deleted.`,
    type: 'warning'
  });

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

  await logActivity({
  user: user._id,
  action: 'RESTORE_INVOICE',
  description: 'Invoice restored',
  ip: req.ip,
  userAgent: req.headers['user-agent']
});

  // Send notification for successful restoration
  await sendNotification({
    userId: userId,
    title: 'Invoice Restored',
    body: `Invoice "${invoice.invoiceName}" (${invoice.invoiceNumber}) has been restored.`,
    type: 'info'
  });

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

  await logActivity({
  user: user._id,
  action: 'CREATE_INVOICE_FROM_QUOTATION',
  description: 'New invoice created from quotation',
  ip: req.ip,
  userAgent: req.headers['user-agent']
});

  // Notification of Successful invoice creation
  await sendNotification({
    userId: user._id,
    title: 'New Invoice Created from Quotation',
    body: `A new invoice has been created from ${quotation.quoteName}. Invoice Number: ${invoiceNumber}`,
    type: 'success'
  });

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

// Check and update status of overdue invoices
exports.checkOverdueInvoices = asyncHandler(async (req, res) => {
  const currentDate = new Date();

  // Find all invoices that are past due date but not marked as overdue, paid, or canceled
  const overdueInvoices = await Invoice.find({
    dueDate: { $lt: currentDate },
    status: { $in: ['pending', 'partial', 'sent', 'viewed'] },
    isDeleted: { $ne: true }
  });

  if (overdueInvoices.length === 0) {
    return res.status(200).json({
      message: 'No new overdue invoices found.',
      checked: true
    });
  }

  // Update all found invoices to overdue status
  const updatedInvoices = [];

  for (const invoice of overdueInvoices) {
    invoice.status = 'overdue';
    if (invoice.payment) {
      invoice.payment.status = 'overdue';
    }

    updatedInvoices.push(await invoice.save());
  }

  res.status(200).json({
    message: `✅ ${updatedInvoices.length} invoices marked as overdue successfully`,
    invoices: updatedInvoices
  });
});

// GET /api/invoices/:id/payment-history
exports.getInvoicePaymentHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const invoice = await Invoice.findOne({
    _id: id,
    creator: userId,
    isDeleted: { $ne: true }
  });

  if (!invoice) {
    return res.status(404).json({
      message: '❌ Invoice not found'
    });
  }

  // Return empty array if no payment history exists
  if (!invoice.paymentHistory || invoice.paymentHistory.length === 0) {
    return res.status(200).json({
      message: 'No payment history found',
      paymentHistory: [],
      currentStatus: invoice.payment?.status || 'pending',
      amountPaid: invoice.payment?.amountPaid || 0,
      total: invoice.total
    });
  }

  // Sort payment history by date in descending order (newest first)
  const sortedHistory = invoice.paymentHistory.sort((a, b) =>
    new Date(b.date) - new Date(a.date)
  );

  res.status(200).json({
    message: '✅ Payment history retrieved successfully',
    paymentHistory: sortedHistory,
    currentStatus: invoice.payment?.status || 'pending',
    amountPaid: invoice.payment?.amountPaid || 0,
    total: invoice.total
  });
});