// /src/controllers/admin/templateController.js
const asyncHandler = require('express-async-handler');
const Template = require('../../models/Template');
const path = require('path');
const fs = require('fs');

exports.uploadTemplate = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!req.files || !req.files.templateFile) {
    return res.status(400).json({ message: 'Template file is required' });
  }

  try {
    const templateFile = req.files.templateFile;
    const fileName = `${Date.now()}-${templateFile.name}`;
    
    // Fix the path to save in the correct directory
    // Using path.resolve to get absolute path from project root
    const savePath = path.resolve(process.cwd(), 'src', 'templates', fileName);
    
    // Ensure the directory exists
    const templateDir = path.dirname(savePath);
    if (!fs.existsSync(templateDir)) {
      fs.mkdirSync(templateDir, { recursive: true });
    }

    await templateFile.mv(savePath);

    const newTemplate = await Template.create({
      name,
      description,
      fileName,
      previewImageUrl: req.body.previewImageUrl || '',
      type: req.body.type || 'quote'
    });

    res.status(201).json({ message: '✅ Template uploaded successfully', template: newTemplate });
  } catch (error) {
    console.error('Template upload error:', error);
    res.status(500).json({ message: 'Error uploading template', error: error.message });
  }
});

exports.uploadInvoiceTemplate = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  
  if (!req.files || !req.files.templateFile) {
    return res.status(400).json({ message: 'Template file is required' });
  }

  try {
    const templateFile = req.files.templateFile;
    const fileName = `${Date.now()}-${templateFile.name}`;
    
    // Define the save path inside 'templates/invoice'
    const savePath = path.resolve(process.cwd(), 'src', 'templates', 'invoice', fileName);

    // Ensure the 'invoice' directory exists
    const templateDir = path.dirname(savePath);
    if (!fs.existsSync(templateDir)) {
      fs.mkdirSync(templateDir, { recursive: true });
    }

    // Move the uploaded file
    await templateFile.mv(savePath);

    // Save record in database
    const newTemplate = await Template.create({
      name,
      description,
      fileName,
      previewImageUrl: req.body.previewImageUrl || '', // Optional
      type: 'invoice'
    });

    res.status(201).json({ message: '✅ Invoice Template uploaded successfully', template: newTemplate });
  } catch (error) {
    console.error('Invoice Template upload error:', error);
    res.status(500).json({ message: 'Error uploading invoice template', error: error.message });
  }
});