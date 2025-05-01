const Client = require('../models/Client');
const asyncHandler = require('express-async-handler');
const { clientValidationSchema } = require('../validators/clientValidator');
const { sendNotification } = require('../services/notificationService');

// @desc    Create a new client
// @route   POST /api/clients
// @access  Private
TODO // Include a Validator here
exports.createClient = async (req, res) => {
    const { clientName, clientAddress, contactPersonName, contactPersonPhone, contactPersonEmail } = req.body;
  
    if (!clientName || !clientAddress || !contactPersonName || !contactPersonPhone || !contactPersonEmail) {
      return res.status(400).json({ message: 'Please provide all required fields.' });
    }
  
    const client = new Client({
      user: req.user._id,
      clientName,
      clientAddress,
      contactPersonName,
      contactPersonPhone,
      contactPersonEmail
    });
  
    await client.save();
    res.status(201).json(client);
  };

// @desc    Get all clients for logged-in user
// @route   GET /api/clients
// @access  Private
exports.getClients = async (req, res) => {
    const { search, page = 1, limit = 10 } = req.query;

    const query = { user: req.user._id };

    if (search) {
        query.$or = [
            { clientName: { $regex: search, $options: 'i' } },
            { contactPersonEmail: { $regex: search, $options: 'i' } }
        ];
    }

    const clients = await Client.find(query)
        .where('isDeleted').equals(false) // Ensures we only get non-deleted clients
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

    const total = await Client.countDocuments(query);

    res.status(200).json({
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
        clients
    });
};

// @desc    Update a client
// @route   PUT /api/clients/:id
// @access  Private
exports.updateClient = async (req, res) => {
    // Validate only the fields that are provided
    const { error } = clientValidationSchema.validate(req.body, {
        allowUnknown: true,  // Allow fields not in schema
        stripUnknown: true,  // Remove fields not in schema
        abortEarly: false,   // Return all errors, not just the first one
        presence: 'optional' // Make all fields optional for updates
    });

    if (error) {
        return res.status(400).json({
            message: 'Please provide valid field values.',
            details: error.details[0].message
        });
    }

    try {
        const client = await Client.findOne({ _id: req.params.id, user: req.user._id });

        if (!client) {
            return res.status(404).json({ message: 'Client not found.' });
        }

        // Update client fields if provided in request
        const { clientName, clientAddress, contactPersonName, contactPersonPhone, contactPersonEmail } = req.body;

        if (clientName) client.clientName = clientName;
        if (clientAddress) client.clientAddress = clientAddress;
        if (contactPersonName) client.contactPersonName = contactPersonName;
        if (contactPersonPhone) client.contactPersonPhone = contactPersonPhone;
        if (contactPersonEmail) client.contactPersonEmail = contactPersonEmail;

        await client.save();
        // Send notification to user about client update
        await sendNotification({
            userId: req.user._id,
            title: 'Client Updated',
            body: `You have successfully updated the client: ${clientName}.`,
            type: 'success'
        });
        res.status(200).json(client);
    } catch (err) {
        res.status(500).json({ message: 'Error updating client', error: err.message });
    }
};

// @desc    Delete a client
// @route   DELETE /api/clients/:id
// @access  Private

exports.deleteClient = asyncHandler(async (req, res) => {
    const client = await Client.findOne({
      _id: req.params.id,
      user: req.user._id,
      isDeleted: false
    });
  
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
  
    client.isDeleted = true;
    client.deletedAt = new Date();
    await client.save();
  
    res.status(200).json({ message: '✅ Client deleted successfully' });
  });

// @desc    Get all deleted clients for logged-in user
// @route   GET /api/clients/deleted
exports.getDeletedClients = asyncHandler(async (req, res) => {
    const clients = await Client.find({
      user: req.user._id,
      isDeleted: true
    }).sort({ deletedAt: -1 });
  
    res.status(200).json({
      success: true,
      count: clients.length,
      clients
    });
  });

// @desc    Restore a deleted client
// @route   POST /api/clients/:id/restore
exports.restoreClient = asyncHandler(async (req, res) => {
    const client = await Client.findOne({
        _id: req.params.id,
        user: req.user._id,
        isDeleted: true
    });

    if (!client) {
        return res.status(404).json({ message: 'Deleted client not found' });
    }

    client.isDeleted = false;
    client.deletedAt = null;
    await client.save();

    // Send notification to user about client restoration
    await sendNotification({
        userId: req.user._id,
        title: 'Client Restored',
        body: `You have successfully restored the client: ${client.clientName}.`,
        type: 'success'
    });

    res.status(200).json({ message: '✅ Client restored successfully' });
});
