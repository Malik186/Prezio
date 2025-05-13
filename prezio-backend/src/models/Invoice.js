// models/Invoice.js
const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema({
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
            type: String, // required if category is 'Other'
            validate: {
                validator: function (value) {
                    // Only required if category is 'Other'
                    return this.type.category !== 'Other' || (value && value.trim().length > 0);
                },
                message: 'otherName is required when category is "Other"'
            }
        }
    },
    discount: { type: Number, default: 0 }
    // Removed applyTax as per requirement - VAT tax will always be applied
}, { _id: false });

// Payment-related schemas
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
    sendMoney: mpesaSendMoneySchema
}, { _id: false });

const bankSchema = new mongoose.Schema({
    bankName: { type: String, required: true },
    accountNumber: { type: String, required: true }
}, { _id: false });

const paymentDetailsSchema = new mongoose.Schema({
    method: { 
        type: String, 
        enum: ['mpesa', 'bank'], 
        required: true 
    },
    mpesa: mpesaSchema,
    bank: bankSchema,
    status: {
        type: String,
        enum: ['pending', 'partial', 'paid', 'overdue', 'canceled', 'sent', 'draft'],
        default: 'pending'
    },
    datePaid: Date,
    amountPaid: { type: Number, default: 0 }
}, { _id: false });

// Payment history tracking schema
const paymentHistorySchema = new mongoose.Schema({
  date: { 
    type: Date, 
    default: Date.now, 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  method: { 
    type: String, 
    enum: ['mpesa', 'bank'], 
    required: true 
  },
  paymentDetails: {
    // For mpesa
    transactionId: String,
    phoneNumber: String,
    // For bank
    bankName: String,
    accountNumber: String,
    transactionReference: String
  },
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

const invoiceSchema = new mongoose.Schema({
    // Basic Fields
    template: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Template',
        required: true
    },
    invoiceName: {
        type: String,
        required: true,
    },
    projectDescription: {
        type: String,
        required: true,
    },
    notes: {
        type: String,
        default: ''
    },
    invoiceNumber: {
        type: String,
        required: true,
    },
    dateIssued: {
        type: Date,
        default: Date.now,
    },
    dueDate: {
        type: Date,
        required: true,
    },
    currency: {
        type: String,
        enum: ['KSH', 'TSH', 'USH', 'USD', 'EUR'],
        required: true
    },
    discount: {
        type: Number,
        default: 0 // flat amount (not percentage)
    },
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

    // Embedded snapshot of client details
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
        address: String,
        invoiceTerms: String
    },

    // Payment details
    payment: paymentDetailsSchema,

    paymentHistory: [paymentHistorySchema], // Array of payment history records

    lineItems: {
        type: [lineItemSchema],
        required: true,
        validate: [array => array.length > 0, 'Invoice must have at least one line item']
    },
    subtotal: Number,
    tax: Number, // VAT tax will always be applied and calculated by controller
    total: Number,
    status: {
        type: String,
        enum: ['draft', 'sent', 'viewed', 'pending', 'partial', 'paid', 'overdue', 'canceled'],
        default: 'draft',
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date
    },
    // Optional related quotation
    quotation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quotation'
    },
    // URLs for PDF and QR code
    pdfUrl: String,
    qrCodeUrl: String,
    viewUrl: String,
}, {
    timestamps: true,
});

module.exports = mongoose.model('Invoice', invoiceSchema);