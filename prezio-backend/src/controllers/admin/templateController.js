const asyncHandler = require('express-async-handler');
const Template = require('../../models/Template');
const path = require('path');
const fs = require('fs');

exports.uploadTemplate = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!req.files || !req.files.templateFile) {
    return res.status(400).json({ message: 'Template file is required' });
  }

  const templateFile = req.files.templateFile;
  const fileName = `${Date.now()}-${templateFile.name}`;
  const savePath = path.join(__dirname, '../../templates', fileName);

  await templateFile.mv(savePath);

  const newTemplate = await Template.create({
    name,
    description,
    fileName,
    previewImageUrl: req.body.previewImageUrl || ''
  });

  res.status(201).json({ message: '✅ Template uploaded successfully', template: newTemplate });
});
