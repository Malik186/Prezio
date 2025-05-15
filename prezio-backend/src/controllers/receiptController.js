const asyncHandler = require('express-async-handler');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const QRCode = require('qrcode');
const Receipt = require('../models/Receipt');
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const User = require('../models/User');
const Template = require('../models/Template');
const validatePayload = require('../utils/validatePayload');
const generateReceiptNumber = require('../utils/generateReceiptNumber');
const { sendNotification } = require('../services/notificationService');
const sendReceiptEmail = require('../utils/sendReceiptEmail');
const { createReceiptEmail } = require('../utils/emailTemplates');
const { recordPaymentHistory } = require('../utils/paymentHistoryManager');

/**
 * Create a receipt - can be linked to an invoice or standalone
 * POST /api/receipts
 */
exports.createReceipt = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    let {
        invoice: invoiceId,
        client: clientId,
        items,
        currency,
        receiptTitle,
        notes,
        template: templateId,
        payment,
        paymentPurpose
    } = req.body;

    // Check if payment status is canceled, if so, return early
    if (payment && payment.status === 'canceled') {
        return res.status(400).json({ message: 'Cannot generate receipt for canceled Invoice' });
    }

    // Declare the invoice variable at this scope level
    let invoice;

    // If invoiceId is provided, fetch invoice and auto-fill fields
    if (invoiceId) {
        invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Auto-fill fields from Invoice
        clientId = invoice.client;
        items = invoice.lineItems.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            type: {
                category: item.type?.category || 'Service', // Default to 'Service' if not present
                otherName: item.type?.otherName
            }
        }));
        currency = invoice.currency;
        notes = notes || invoice.notes; // allow overriding notes
    }

    // Now validate fields (whether manually provided or autofilled)
    const requiredFields = ['client', 'items', 'currency', 'template', 'payment', 'payment.amountPaid'];

    const missingFields = validatePayload({ client: clientId, items, currency, template: templateId, payment }, requiredFields);

    if (missingFields.length) {
        return res.status(400).json({ message: `Missing required fields: ${missingFields.join(', ')}` });
    }

    if (!validatePaymentDetails(payment)) {
        return res.status(400).json({ message: 'Invalid payment details' });
    }

    const [client, template] = await Promise.all([
        Client.findOne({ _id: clientId, user: userId }),
        Template.findById(templateId)
    ]);

    if (!template) return res.status(404).json({ message: 'Selected Template not found' });
    if (!client) return res.status(404).json({ message: 'Client not found' });

    // Use findOneAndUpdate with atomic operation to safely increment the receipt number
    // This avoids race conditions by using MongoDB's atomic operations
    const updatedUser = await User.findOneAndUpdate(
        { _id: userId },
        { $inc: { lastReceiptNumber: 1 } },
        { new: true }
    );

    if (!updatedUser) return res.status(404).json({ message: 'User not found' });

    const receiptNumber = generateReceiptNumber(updatedUser.lastReceiptNumber);

    let subtotal = 0;
    let tax = 0;
    const taxRate = 16;

    items.forEach(item => {
        const lineTotal = item.quantity * item.unitPrice;
        subtotal += lineTotal;
        tax += lineTotal * (taxRate / 100);
    });

    const total = subtotal + tax;

    const receiptData = {
        receiptNumber,
        receiptTitle: receiptTitle || 'Payment Receipt',
        dateIssued: new Date(),
        client: client._id,
        creator: updatedUser._id,
        currency,
        items,
        subtotal,
        tax,
        taxRate,
        total,
        notes: notes || 'Thank you for your business!',
        template: template._id,
        payment,
        paymentPurpose: paymentPurpose || 'Invoice Payment',
        clientSnapshot: {
            name: client.clientName,
            address: client.clientAddress,
            contactPhone: client.contactPersonPhone,
            contactEmail: client.contactPersonEmail
        },
        creatorSnapshot: {
            companyName: updatedUser.companyName || '',
            position: updatedUser.position || '',
            firstName: updatedUser.firstName || '',
            middleName: updatedUser.middleName || '',
            surname: updatedUser.surname || '',
            logo: {
                url: updatedUser.logo?.url || '',
                public_id: updatedUser.logo?.public_id || ''
            },
            email: updatedUser.email,
            phone: updatedUser.phone || '',
            address: updatedUser.address || ''
        }
    };

    if (invoiceId && invoice) {
        receiptData.invoice = invoiceId;
        receiptData.invoiceSnapshot = {
            invoiceNumber: invoice.invoiceNumber,
            invoiceDate: invoice.dateIssued,
            invoiceTotal: invoice.total,
            previouslyPaid: invoice.payment.amountPaid || 0,
            balanceDue: invoice.total - payment.amountPaid - (invoice.payment.amountPaid || 0)
        };

        // Record payment history for invoice
        await recordPaymentHistory(invoice, {
            amountPaid: payment.amountPaid,
            previousAmount: invoice.payment?.amountPaid || 0,
            paymentMethod: payment.method,
            paymentDetails: payment,
            notes: `Receipt ${receiptNumber} - ${payment.amountPaid} ${currency}`,
            datePaid: new Date(),
            userId: req.user._id
        });

        const totalPaid = (invoice.payment.amountPaid || 0) + payment.amountPaid;
        if (totalPaid >= invoice.total) {
            invoice.payment.status = 'paid';
            invoice.status = 'paid';
        } else if (totalPaid > 0) {
            invoice.payment.status = 'partial';
            invoice.status = 'partial';
        }
        invoice.payment.amountPaid = totalPaid;
        invoice.payment.datePaid = new Date();
        await invoice.save();

        // Notication to client
        await sendNotification({
            userId: user._id,
            title: 'Receipt created',
            message: `Receipt ${receiptNumber} has been created for Invoice ${invoice.invoiceNumber}.`,
            type: 'success'
        });
    }

    try {
        const receipt = await Receipt.create(receiptData);

        const frontendBaseUrl = process.env.FRONTEND_URL || 'https://yourapp.com';
        const viewUrl = `${frontendBaseUrl}/receipts/view/${receipt._id}`;
        const qrCodeUrl = await generateQRCode(viewUrl);

        if (qrCodeUrl) {
            receipt.qrCodeUrl = qrCodeUrl;
            receipt.viewUrl = viewUrl;
            await receipt.save();
            // Send Notification to client
            await sendNotification({
                userId: user._id,
                title: 'Receipt created',
                message: `Receipt ${receipt.receiptNumber} has been created.`,
                type: 'success'
            });
        }

        res.status(201).json({ message: '✅ Receipt created successfully', receipt });
    } catch (error) {
        // If we encounter a duplicate key error, try one more time with a new number
        if (error.code === 11000 && error.keyPattern && error.keyPattern.receiptNumber) {
            // Increment the receipt number again
            const retryUser = await User.findOneAndUpdate(
                { _id: userId },
                { $inc: { lastReceiptNumber: 1 } },
                { new: true }
            );

            // Generate a new receipt number
            receiptData.receiptNumber = generateReceiptNumber(retryUser.lastReceiptNumber);

            // Try creating the receipt again
            const receipt = await Receipt.create(receiptData);

            const frontendBaseUrl = process.env.FRONTEND_URL || 'https://yourapp.com';
            const viewUrl = `${frontendBaseUrl}/receipts/view/${receipt._id}`;
            const qrCodeUrl = await generateQRCode(viewUrl);

            if (qrCodeUrl) {
                receipt.qrCodeUrl = qrCodeUrl;
                receipt.viewUrl = viewUrl;
                await receipt.save();
                // Send Notification to client
                await sendNotification({
                    userId: user._id,
                    title: 'Receipt created',
                    message: `Receipt ${receipt.receiptNumber} has been created.`,
                    type: 'success'
                });
            }

            res.status(201).json({ message: '✅ Receipt created successfully', receipt });
        } else {
            // If it's not a duplicate key error or second attempt fails, throw the error
            throw error;
        }
    }
});

// Validate payment details helper function
function validatePaymentDetails(payment) {
    if (!payment || !payment.method || !payment.amountPaid) return false;

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
    } else if (payment.method === 'cash') {
        return payment.cash && payment.cash.receivedBy;
    }

    return false;
}

/**
 * Auto-generate receipt when invoice is marked as paid or partial
 * This function should be called from the invoice payment status update controller
 */
exports.autoGenerateReceipt = asyncHandler(async (invoiceId, paymentDetails) => {
    try {
        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            throw new Error('Invoice not found');
        }

        const user = await User.findById(invoice.creator);
        if (!user) {
            throw new Error('User not found');
        }

        // Use the default receipt template or fall back to the invoice template
        const template = await Template.findOne({
            creator: invoice.creator,
            type: 'receipt',
            isDefault: true
        }) || invoice.template;

        if (!template) {
            throw new Error('No suitable template found');
        }

        // Generate receipt number
        const nextNumber = (user.lastReceiptNumber || 0) + 1;
        const receiptNumber = generateReceiptNumber(nextNumber);
        user.lastReceiptNumber = nextNumber;
        await user.save();

        // Amount being paid now (for partial payments)
        const currentPayment = paymentDetails.amountPaid - (invoice.payment.amountPaid || 0);

        // Determine which items are being paid for
        // For partial payments, we'll create receipt items proportionally
        const receiptItems = [];
        let runningTotal = 0;
        let itemsSubtotal = 0;
        let itemsTax = 0;

        // Calculate how much of each line item to allocate to this payment
        for (const item of invoice.lineItems) {
            const itemTotal = item.quantity * item.unitPrice;
            const itemPercentage = itemTotal / invoice.total;
            const itemPortionPaid = currentPayment * itemPercentage;

            if (itemPortionPaid <= 0) continue;

            // Create a proportional receipt item
            const portionQuantity = (itemPortionPaid / item.unitPrice);

            receiptItems.push({
                description: item.description,
                quantity: portionQuantity >= item.quantity ? item.quantity : portionQuantity,
                unitPrice: item.unitPrice,
                type: item.type,
                discount: item.discount
            });

            const thisItemSubtotal = portionQuantity * item.unitPrice;
            itemsSubtotal += thisItemSubtotal;
            itemsTax += thisItemSubtotal * 0.16; // 16% VAT

            runningTotal += thisItemSubtotal * 1.16; // Including tax

            // If we've allocated enough items to cover the payment, stop
            if (runningTotal >= currentPayment) break;
        }

        // Create receipt payment details
        const receiptPayment = {
            ...paymentDetails,
            amountPaid: currentPayment
        };

        const receiptData = {
            receiptNumber,
            receiptTitle: `Receipt for Invoice #${invoice.invoiceNumber}`,
            dateIssued: new Date(),
            client: invoice.client,
            creator: invoice.creator,
            currency: invoice.currency,
            items: receiptItems,
            subtotal: itemsSubtotal,
            tax: itemsTax,
            taxRate: 16, // 16% VAT
            total: itemsSubtotal + itemsTax,
            notes: 'Thank you for your payment!',
            template: template._id,
            payment: receiptPayment,
            invoice: invoice._id,
            invoiceSnapshot: {
                invoiceNumber: invoice.invoiceNumber,
                invoiceDate: invoice.dateIssued,
                invoiceTotal: invoice.total,
                previouslyPaid: invoice.payment.amountPaid - currentPayment || 0,
                balanceDue: invoice.total - invoice.payment.amountPaid || 0
            },
            clientSnapshot: invoice.clientSnapshot,
            creatorSnapshot: invoice.creatorSnapshot
        };

        const receipt = await Receipt.create(receiptData);

        // Generate QR code and view URL
        const frontendBaseUrl = process.env.FRONTEND_URL || 'https://yourapp.com';
        const viewUrl = `${frontendBaseUrl}/receipts/view/${receipt._id}`;
        const qrCodeUrl = await generateQRCode(viewUrl);

        if (qrCodeUrl) {
            receipt.qrCodeUrl = qrCodeUrl;
            receipt.viewUrl = viewUrl;
            await receipt.save();
        }

        // Send receipt to client
        await sendReceiptToClient(receipt._id);

        await sendNotification({
            userId: user._id,
            title: 'Receipt created',
            message: `Receipt ${receipt.receiptNumber} has been generated and Sent to client.`,
            type: 'success'
        });

        return receipt;
    } catch (error) {
        console.error('Error auto-generating receipt:', error);
        throw error;
    }
});

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

/**
 * Preview receipt
 * GET /api/receipts/:id/preview
 */
exports.previewReceipt = asyncHandler(async (req, res) => {
    try {
        const receipt = await Receipt.findById(req.params.id)
            .populate('template')
            .populate('client')
            .populate('invoice');

        if (!receipt) return res.status(404).json({ message: 'Receipt not found' });

        // Fetch template from Cloudinary
        if (!receipt.template.fileUrl) {
            return res.status(404).json({
                message: 'Template URL not found'
            });
        }

        let templateHtml;
        try {
            templateHtml = await getTemplateFromCloudinary(receipt.template.fileUrl);
        } catch (error) {
            return res.status(404).json({
                message: 'Error fetching template',
                error: error.message
            });
        }

        // Configure Handlebars with allowProtoProperties to address the warning
        const compiled = Handlebars.compile(templateHtml);

        // Convert Mongoose documents to plain JavaScript objects
        const plainReceipt = receipt.toObject ? receipt.toObject() : JSON.parse(JSON.stringify(receipt));

        // Generate QR code for the receipt if frontend URL is provided
        const frontendBaseUrl = process.env.FRONTEND_URL || 'https://yourapp.com';
        const receiptUrl = `${frontendBaseUrl}/receipts/view/${plainReceipt._id}`;
        const receiptQrCode = await generateQRCode(receiptUrl);

        // Set up pagination for items (10 items per page)
        const ITEMS_PER_PAGE = 10;
        const items = plainReceipt.items.map(item => ({ ...item })); // Create plain objects
        const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);

        // Organize items into pages
        const pages = [];
        for (let i = 0; i < totalPages; i++) {
            const startIdx = i * ITEMS_PER_PAGE;
            const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, items.length);
            pages.push({
                items: items.slice(startIdx, endIdx),
                isLastPage: i === totalPages - 1
            });
        }

        // Format payment details for display
        const paymentDetails = getFormattedPaymentDetails(plainReceipt.payment);

        // Prepare the data for the template
        const templateData = {
            receipt: plainReceipt,
            client: plainReceipt.clientSnapshot,
            user: plainReceipt.creatorSnapshot,
            pages: pages,
            totalPages: totalPages,
            receiptQrCode: receiptQrCode,
            subtotal: plainReceipt.subtotal,
            tax: plainReceipt.tax,
            taxRate: plainReceipt.taxRate,
            total: plainReceipt.total,
            receiptTitle: plainReceipt.receiptTitle,
            notes: plainReceipt.notes,
            currency: plainReceipt.currency,
            payment: paymentDetails,
            invoice: plainReceipt.invoiceSnapshot,
            // Include metadata for PDF generation
            meta: {
                title: `Receipt for ${plainReceipt.clientSnapshot.name}`,
                fileName: `Receipt-${plainReceipt.receiptNumber}.pdf`
            }
        };

        // Generate HTML with optimizations for PDF conversion
        let html = compiled(templateData);

        // Optionally add PDF-specific styles to the HTML
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
        console.error('Error previewing receipt:', error);
        res.status(500).json({
            message: 'Error generating receipt preview',
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
            if (payment.mpesa.transactionId) {
                result.transactionId = payment.mpesa.transactionId;
            }
        } else if (payment.mpesa.type === 'sendMoney') {
            result.details = `Phone Number: ${payment.mpesa.sendMoney.phoneNumber}`;
            if (payment.mpesa.transactionId) {
                result.transactionId = payment.mpesa.transactionId;
            }
        }
    } else if (payment.method === 'bank') {
        result.details = `Bank: ${payment.bank.bankName}, Account: ${payment.bank.accountNumber}`;
        if (payment.bank.transactionReference) {
            result.transactionReference = payment.bank.transactionReference;
        }
    } else if (payment.method === 'cash') {
        result.details = `Received By: ${payment.cash.receivedBy}`;
    }

    result.amountPaid = payment.amountPaid;

    return result;
}

/**
 * Send receipt to client via email
 * POST /api/receipts/:id/send
 */
exports.sendReceiptToClient = asyncHandler(async (req, res) => {
    try {
        const receiptId = typeof req === 'string' ? req : req.params.id;
        const receipt = await Receipt.findById(receiptId);

        if (!receipt) {
            if (res) return res.status(404).json({ message: 'Receipt not found' });
            throw new Error('Receipt not found');
        }

        // If called from a route handler, verify authorization
        if (res && req.user && !receipt.creator.equals(req.user._id)) {
            return res.status(403).json({ message: 'Not authorized to send this receipt' });
        }

        // Use the email stored in the receipt's clientSnapshot
        const clientEmail = receipt.clientSnapshot.contactEmail;
        if (!clientEmail) {
            if (res) return res.status(400).json({ message: 'Client email not found in receipt' });
            throw new Error('Client email not found in receipt');
        }

        // Generate receipt URL
        const frontendBaseUrl = process.env.FRONTEND_URL || 'https://yourapp.com';
        const receiptUrl = `${frontendBaseUrl}/receipts/view/${receiptId}`;

        // Create email subject
        const emailSubject = `Receipt: ${receipt.receiptTitle} from ${receipt.creatorSnapshot.companyName}`;

        // Using sendReceiptEmail utility
        await sendReceiptEmail({
            to: clientEmail,
            subject: emailSubject,
            html: createReceiptEmail(receipt, receiptUrl)
        });

        // Send notification to user
        await sendNotification({
            userId: receipt.creator,
            title: 'Receipt sent',
            message: `Receipt ${receipt.receiptNumber} has been sent to ${clientEmail}.`,
            type: 'success'
        });

        if (res) {
            res.status(200).json({
                success: true,
                message: `✅ Receipt sent successfully to ${clientEmail}`
            });
        }

        return true;
    } catch (error) {
        console.error('Error sending receipt email:', error);
        if (res) {
            res.status(500).json({
                success: false,
                message: 'Error sending receipt email',
                error: error.message
            });
        }
        throw error;
    }
});

/**
 * Get all receipts with pagination and filtering
 * GET /api/receipts?page=&limit=&search=
 */
exports.getReceipts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search } = req.query;
    const userId = req.user._id;

    const query = {
        creator: userId,
        isDeleted: { $ne: true } // Exclude soft-deleted receipts
    };

    if (search) {
        query.$or = [
            { receiptNumber: new RegExp(search, 'i') },
            { receiptTitle: new RegExp(search, 'i') },
            { 'clientSnapshot.name': new RegExp(search, 'i') },
            { 'invoiceSnapshot.invoiceNumber': new RegExp(search, 'i') }
        ];
    }

    const total = await Receipt.countDocuments(query);
    const receipts = await Receipt.find(query)
        .sort({ dateIssued: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

    res.json({
        total,
        page: Number(page),
        limit: Number(limit),
        receipts
    });
});

/**
 * Get receipt by ID
 * GET /api/receipts/:id
 */
exports.getReceiptById = asyncHandler(async (req, res) => {
    const receiptId = req.params.id;
    const userId = req.user._id;

    const receipt = await Receipt.findOne({
        _id: receiptId,
        creator: userId,
        isDeleted: { $ne: true }
    }).populate('invoice', 'invoiceNumber invoiceName');

    if (!receipt) {
        return res.status(404).json({ message: 'Receipt not found' });
    }

    res.status(200).json(receipt);
});

/**
 * Soft delete receipt
 * DELETE /api/receipts/:id
 */
exports.softDeleteReceipt = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const receiptId = req.params.id;

    const receipt = await Receipt.findOne({
        _id: receiptId,
        creator: userId,
        isDeleted: { $ne: true }
    });

    if (!receipt) {
        return res.status(404).json({ message: 'Receipt not found' });
    }

    receipt.isDeleted = true;
    receipt.deletedAt = new Date();
    await receipt.save();

    // Send notification to user
    await sendNotification({
        userId: userId,
        title: 'Receipt deleted',
        message: `Receipt ${receipt.receiptNumber} has been deleted.`,
        type: 'warning'
    });

    res.status(200).json({ message: '🗑️ Receipt soft-deleted successfully' });
});

/**
 * Get soft-deleted receipts
 * GET /api/receipts/trash?page=&limit=&search=
 */
exports.getSoftDeletedReceipts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search } = req.query;
    const userId = req.user._id;

    const query = {
        creator: userId,
        isDeleted: true
    };

    if (search) {
        query.$or = [
            { receiptNumber: new RegExp(search, 'i') },
            { receiptTitle: new RegExp(search, 'i') },
            { 'clientSnapshot.name': new RegExp(search, 'i') }
        ];
    }

    const total = await Receipt.countDocuments(query);
    const receipts = await Receipt.find(query)
        .sort({ deletedAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

    res.json({
        total,
        page: Number(page),
        limit: Number(limit),
        receipts
    });
});

/**
 * Restore soft-deleted receipt
 * PUT /api/receipts/:id/restore
 */
exports.restoreReceipt = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const receiptId = req.params.id;

    const receipt = await Receipt.findOne({
        _id: receiptId,
        creator: userId,
        isDeleted: true
    });

    if (!receipt) {
        return res.status(404).json({ message: 'Deleted receipt not found' });
    }

    receipt.isDeleted = false;
    receipt.deletedAt = null;
    await receipt.save();
    
    // Send notification to user
    await sendNotification({
        userId: userId,
        title: 'Receipt restored',
        message: `Receipt ${receipt.receiptNumber} has been restored.`,
        type: 'success'
    });

    res.status(200).json({ message: '♻️ Receipt restored successfully', receipt });
});

/**
 * Get receipts by invoice ID
 * GET /api/receipts/invoice/:invoiceId
 */
exports.getReceiptsByInvoice = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { invoiceId } = req.params;

    const receipts = await Receipt.find({
        creator: userId,
        invoice: invoiceId,
        isDeleted: { $ne: true }
    }).sort({ dateIssued: -1 });

    res.status(200).json(receipts);
});