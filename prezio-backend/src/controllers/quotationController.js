const asyncHandler = require('express-async-handler');
const Quotation = require('../models/Quotation');
const Client = require('../models/Client');
const User = require('../models/User');
const generateQuoteNumber = require('../utils/generateQuoteNumber');

exports.createQuotation = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const {
        validUntil,
        client: clientId,
        lineItems,
        currency,
        quoteName,
        discount = 0
    } = req.body;

    if (!clientId || !lineItems?.length || !validUntil || !currency || !quoteName) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    // 1. Get client and user details
    const client = await Client.findOne({ _id: clientId, user: userId });
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 2. Generate user-specific 5-digit quote number using user's lastQuoteNumber
    const nextNumber = (user.lastQuoteNumber || 0) + 1;
    const quoteNumber = generateQuoteNumber(nextNumber);

    // Update user's lastQuoteNumber
    user.lastQuoteNumber = nextNumber;
    await user.save();

    // 3. Calculate subtotal, tax, total
    let subtotal = 0;
    let tax = 0;

    lineItems.forEach(item => {
        const lineTotal = item.quantity * item.unitPrice;
        subtotal += lineTotal;
        if (item.applyTax) tax += lineTotal * 0.16;
    });

    const total = subtotal + tax - discount;

    // 4. Save quotation
    const quotation = await Quotation.create({
        quoteNumber,
        quoteName,
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
      
        clientSnapshot: {
          name: client.clientName,
          address: client.clientAddress,
          contactPhone: client.contactPersonPhone,
          contactEmail: client.contactPersonEmail
        },
      
        creatorSnapshot: {
          companyName: user.companyName || '',
          logo: {
            url: user.logo?.url || '',
            public_id: user.logo?.public_id || ''
          },
          email: user.email,
          phone: user.phone || '',
          address: user.address || ''
        }
      });
      

    res.status(201).json({ message: '✅ Quotation created successfully', quotation });
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

    res.status(200).json({ message: '♻️ Quotation restored successfully', quotation });
});