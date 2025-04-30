const asyncHandler = require('express-async-handler');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const Quotation = require('../models/Quotation');
const Client = require('../models/Client');
const User = require('../models/User');
const Template = require('../models/Template');
const generateQuoteNumber = require('../utils/generateQuoteNumber');
const sendQuotationEmail = require('../utils/sendQuotationEmail');

exports.createQuotation = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const {
      validUntil,
      client: clientId,
      lineItems,
      currency,
      quoteName,
      discount = 0,
      template: templateId
    } = req.body;
  
    if (!clientId || !lineItems?.length || !validUntil || !currency || !quoteName || !templateId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
  
    const [client, user, template] = await Promise.all([
      Client.findOne({ _id: clientId, user: userId }),
      User.findById(userId),
      Template.findById(templateId)
    ]);
  
    if (!client) return res.status(404).json({ message: 'Client not found' });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!template) return res.status(404).json({ message: 'Template not found' });
  
    const nextNumber = (user.lastQuoteNumber || 0) + 1;
    const quoteNumber = generateQuoteNumber(nextNumber);
    user.lastQuoteNumber = nextNumber;
    await user.save();
  
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
  
  //
  exports.previewQuotation = asyncHandler(async (req, res) => {
    try {
      const quotation = await Quotation.findById(req.params.id)
        .populate('template')
        .populate('client');
    
      if (!quotation) return res.status(404).json({ message: 'Quotation not found' });
    
      // Using the same path resolution approach as in templateController
      const templatePath = path.resolve(process.cwd(), 'src', 'templates', quotation.template.fileName);
      
      // Check if template file exists
      if (!fs.existsSync(templatePath)) {
        return res.status(404).json({ 
          message: 'Template file not found', 
          path: templatePath 
        });
      }
      
      const templateHtml = fs.readFileSync(templatePath, 'utf-8');
      const compiled = Handlebars.compile(templateHtml);
    
      const html = compiled({
        quotation,
        client: quotation.clientSnapshot,
        user: quotation.creatorSnapshot,
        lineItems: quotation.lineItems,
        subtotal: quotation.subtotal,
        tax: quotation.tax,
        total: quotation.total,
        discount: quotation.discount,
        currency: quotation.currency,
        validUntil: quotation.validUntil
      });
    
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
  exports.sendQuotation = asyncHandler(async (req, res) => {
    const quotation = await Quotation.findById(req.params.id).populate('template');
    const clientEmail = quotation.clientSnapshot.contactEmail;
  
    if (!quotation || !clientEmail) return res.status(404).json({ message: 'Quotation or client email not found' });
  
    const templatePath = path.join(__dirname, '..', 'templates', quotation.template.fileName);
    const compiled = Handlebars.compile(fs.readFileSync(templatePath, 'utf-8'));
  
    const html = compiled({
      quotation,
      client: quotation.clientSnapshot,
      user: quotation.creatorSnapshot,
      lineItems: quotation.lineItems,
      subtotal: quotation.subtotal,
      tax: quotation.tax,
      total: quotation.total,
      discount: quotation.discount,
      currency: quotation.currency,
      validUntil: quotation.validUntil
    });
  
    await sendQuotationEmail(clientEmail, `Quotation from ${quotation.creatorSnapshot.companyName}`, html);
  
    res.json({ message: '📩 Quotation sent to client email' });
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