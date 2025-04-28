const Client = require('../models/Client');
const { clientValidationSchema } = require('../validators/clientValidator');

// @desc    Create a new client
// @route   POST /api/clients
// @access  Private
exports.createClient = async (req, res) => {
    // Validate request body using Joi schema
    const { error } = clientValidationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        message: 'Please fill out all required fields correctly.',
        details: error.details[0].message 
      });
    }
  
    // Extract fields from validated request body
    const { clientName, clientAddress, contactPersonName, contactPersonPhone, contactPersonEmail } = req.body;
  
    // Create new client
    const client = new Client({
      user: req.user._id,
      clientName,
      clientAddress,
      contactPersonName,
      contactPersonPhone,
      contactPersonEmail
    });
  
    // Save client to database
    try {
      await client.save();
      res.status(201).json(client);
    } catch (err) {
      res.status(500).json({ message: 'Error creating client', error: err.message });
    }
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
      res.status(200).json(client);
    } catch (err) {
      res.status(500).json({ message: 'Error updating client', error: err.message });
    }
  };

// @desc    Delete a client
// @route   DELETE /api/clients/:id
// @access  Private
exports.deleteClient = async (req, res) => {
  const client = await Client.findOne({ _id: req.params.id, user: req.user._id });

  if (!client) {
    return res.status(404).json({ message: 'Client not found.' });
  }

  await client.deleteOne();
  res.status(200).json({ message: 'Client deleted successfully.' });
};
