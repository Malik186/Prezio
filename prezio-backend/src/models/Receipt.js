// models/Receipt.js
const mongoose = require('mongoose');

// Receipt Item Schema - Simplified version of invoice line items
const receiptItemSchema = new mongoose.Schema({
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    type: {
        category: {
            type: String,
            enum: ['Service', 'Product', 'Other'],
            required: true
        },
        otherName: {
            type: String,
            validate: {
                validator: function (value) {
                    return this.type.category !== 'Other' || (value && value.trim().length > 0);
                },
                message: 'otherName is required when category is "Other"'
            }
        }
    },
    discount: { type: Number, default: 0 }
}, { _id: false });

// Payment method schemas (same as Invoice for consistency)
const mpesaPaybillSchema = new mongoose.Schema({
    tillNumber: { type: String, required: true }
}, { _id: false });

const mpesaSendMoneySchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true },
    isNewNumber: { type: Boolean, default: false }
}, { _id: false });

const mpesaSchema = new mongoose.Schema({
    type: { 
        type: String, 
        enum: ['paybill', 'sendMoney'], 
        required: true 
    },
    paybill: mpesaPaybillSchema,
    sendMoney: mpesaSendMoneySchema,
    transactionId: { type: String } // M-PESA confirmation code
}, { _id: false });

const bankSchema = new mongoose.Schema({
    bankName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    transactionReference: { type: String } // Bank payment reference
}, { _id: false });

const cashSchema = new mongoose.Schema({
    receivedBy: { type: String, required: true }
}, { _id: false });

const paymentDetailsSchema = new mongoose.Schema({
    method: { 
        type: String, 
        enum: ['mpesa', 'bank', 'cash'], 
        required: true 
    },
    mpesa: mpesaSchema,
    bank: bankSchema,
    cash: cashSchema,
    amountPaid: { type: Number, required: true }
}, { _id: false });

const receiptSchema = new mongoose.Schema({
    // Basic Fields
    template: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Template',
        required: true
    },
    receiptNumber: {
        type: String,
        required: true,
        unique: true
    },
    dateIssued: {
        type: Date,
        default: Date.now,
        required: true
    },
    receiptTitle: {
        type: String,
        default: 'Payment Receipt'
    },
    currency: {
        type: String,
        enum: ['KSH', 'TSH', 'USH', 'USD', 'EUR'],
        required: true
    },
    
    // Associated invoice (if any)
    invoice: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Invoice'
    },
    
    // For partial payments, we need to know which invoice this receipt is for
    invoiceSnapshot: {
        invoiceNumber: String,
        invoiceDate: Date,
        invoiceTotal: Number,
        previouslyPaid: Number,
        balanceDue: Number
    },
    
    // Client and creator references
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        required: true,
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },

    // Embedded snapshot of client and creator details (for historical records)
    clientSnapshot: {
        name: String,
        address: String,
        contactPhone: String,
        contactEmail: String
    },
    creatorSnapshot: {
        companyName: String,
        position: String,
        firstName: String,
        middleName: String,
        surname: String,
        logo: {
            url: String,
            public_id: String
        },
        email: String,
        phone: String,
        address: String
    },

    // Payment information
    payment: paymentDetailsSchema,
    
    // Items being paid for (can be a subset of invoice items for partial payments)
    items: {
        type: [receiptItemSchema],
        required: true,
        validate: [array => array.length > 0, 'Receipt must have at least one item']
    },
    
    // Financial details
    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true }, // VAT amount
    taxRate: { type: Number, default: 16 }, // VAT rate (percent)
    total: { type: Number, required: true },
    
    // Additional fields
    notes: {
        type: String,
        default: 'Thank you for your business!'
    },
    
    // For non-invoice payments (e.g., deposits, retainers)
    paymentPurpose: {
        type: String,
        default: 'Invoice Payment'
    },
    
    // URLs for PDF and QR code
    pdfUrl: String,
    qrCodeUrl: String,
    viewUrl: String,
    
    // Soft delete functionality
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Add pre-save middleware to ensure receipt number format if needed
receiptSchema.pre('save', function(next) {
    // Could add logic here to auto-generate receipt numbers
    // For example: RCP-YYYY-MM-XXXX
    next();
});

module.exports = mongoose.model('Receipt', receiptSchema);