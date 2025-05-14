const asyncHandler = require('express-async-handler');
const Template = require('../../models/Template');
const { cloudinary } = require('../../config/cloudinary');

exports.uploadTemplate = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!req.files || !req.files.templateFile) {
    return res.status(400).json({ message: 'Template file is required' });
  }

  try {
    const templateFile = req.files.templateFile;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(templateFile.tempFilePath, {
      folder: 'prezio-templates',
      resource_type: 'raw',
      format: 'html'
    });

    const newTemplate = await Template.create({
      name,
      description,
      fileName: templateFile.name,
      fileUrl: result.secure_url,
      public_id: result.public_id,
      previewImageUrl: req.body.previewImageUrl || '',
      type: req.body.type || 'quote'
    });

    res.status(201).json({
      message: '✅ Template uploaded successfully',
      template: newTemplate
    });
  } catch (error) {
    console.error('Template upload error:', error);
    res.status(500).json({
      message: 'Error uploading template',
      error: error.message
    });
  }
});

exports.uploadInvoiceTemplate = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!req.files || !req.files.templateFile) {
    return res.status(400).json({ message: 'Template file is required' });
  }

  try {
    const templateFile = req.files.templateFile;

    // Upload to Cloudinary with invoice-specific folder
    const result = await cloudinary.uploader.upload(templateFile.tempFilePath, {
      folder: 'prezio-templates/invoice',
      resource_type: 'raw',
      format: 'html'
    });

    // Save record in database
    const newTemplate = await Template.create({
      name,
      description,
      fileName: templateFile.name,
      fileUrl: result.secure_url,
      public_id: result.public_id,
      previewImageUrl: req.body.previewImageUrl || '',
      type: 'invoice'
    });

    res.status(201).json({
      message: '✅ Invoice Template uploaded successfully',
      template: newTemplate
    });
  } catch (error) {
    console.error('Invoice Template upload error:', error);
    res.status(500).json({
      message: 'Error uploading invoice template',
      error: error.message
    });
  }
});

// Add a cleanup function when deleting templates
exports.deleteTemplate = asyncHandler(async (req, res) => {
  const template = await Template.findById(req.params.id);

  if (!template) {
    return res.status(404).json({ message: 'Template not found' });
  }

  try {
    // Delete from Cloudinary
    if (template.public_id) {
      await cloudinary.uploader.destroy(template.public_id, {
        resource_type: 'raw'
      });
    }

    // Delete from database
    await template.remove();

    res.json({
      message: '✅ Template deleted successfully'
    });
  } catch (error) {
    console.error('Template deletion error:', error);
    res.status(500).json({
      message: 'Error deleting template',
      error: error.message
    });
  }
});