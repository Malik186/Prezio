const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const express = require('express');
const fileUpload = require('express-fileupload');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure express-fileupload
const fileUploadMiddleware = fileUpload({
  useTempFiles: true,
  tempFileDir: './temp/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  abortOnLimit: true
});

module.exports = { 
  cloudinary, 
  fileUploadMiddleware 
};