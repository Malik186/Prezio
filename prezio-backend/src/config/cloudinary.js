// config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'prezio-logos',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }],
  },
});

// Template storage configuration
const templateStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'prezio-templates',
    allowed_formats: ['html'],
    resource_type: 'raw'
  },
});

module.exports = { cloudinary, storage, templateStorage };
