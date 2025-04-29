// models/Quotation.js
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
    discount: { type: Number, default: 0 },
    applyTax: {
        type: Boolean,
        default: false
    }
}, { _id: false });

const quotationSchema = new mongoose.Schema({

    // Basic Fields
    quoteName: {
        type: String,
        required: true,
    },
    quoteNumber: {
        type: String,
        required: true,
    },
    dateIssued: {
        type: Date,
        default: Date.now,
    },
    validUntil: {
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
        logo: {
            url: String,
            public_id: String
        },
        email: String,
        phone: String,
        address: String
    },


    lineItems: {
        type: [lineItemSchema],
        required: true,
        validate: [array => array.length > 0, 'Quotation must have at least one line item']
    },
    subtotal: Number,
    tax: Number,
    total: Number,
    status: {
        type: String,
        enum: ['draft', 'sent', 'viewed', 'accepted', 'rejected'],
        default: 'draft',
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date
    },
    // URLs for PDF and QR code
    pdfUrl: String,
    qrCodeUrl: String,
    viewUrl: String,
}, {
    timestamps: true,
});

module.exports = mongoose.model('Quotation', quotationSchema);