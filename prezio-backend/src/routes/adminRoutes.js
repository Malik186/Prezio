const express = require('express');
const { listCronJobs } = require('../utils/cronManager');
const { uploadTemplate } = require('../controllers/admin/templateController');
const { uploadInvoiceTemplate } = require('../controllers/admin/templateController');
const protect = require('../middleware/authMiddleware');
const router = express.Router();
const fileUpload = require('express-fileupload');

router.use(fileUpload()); // for handling file uploads

// Example: GET /api/admin/cron-jobs
router.get('/cron-jobs', protect, protect.adminOnly, (req, res) => {
  const jobs = listCronJobs();
  res.status(200).json(jobs);
});

// Example: POST /api/admin/upload-template
// This route is for uploading a new template
router.post('/upload-template', protect, protect.adminOnly, uploadTemplate);
// Example: POST /api/admin/templates/invoice/upload
// This route is for uploading a new invoice template
router.post('/templates/invoice/upload', protect, protect.adminOnly, uploadInvoiceTemplate);

module.exports = router;