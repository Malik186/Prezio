const express = require('express');
const { listCronJobs } = require('../utils/cronManager');
const {
  uploadTemplate,
  uploadInvoiceTemplate,
  deleteTemplate
} = require('../controllers/admin/templateController');
const { getAdminDashboardStats } = require('../controllers/admin/adminController');
const { fileUploadMiddleware } = require('../config/cloudinary');
const protect = require('../middleware/authMiddleware');
const router = express.Router();

// Cron jobs route
router.get('/cron-jobs', protect, protect.adminOnly, (req, res) => {
  const jobs = listCronJobs();
  res.status(200).json(jobs);
});

// Admin dashboard route
router.get(
  '/dashboard',
  protect,
  protect.adminOnly,
  getAdminDashboardStats
);

// Template routes
router.post(
  '/upload-template',
  protect,
  protect.adminOnly,
  fileUploadMiddleware,
  uploadTemplate
);

router.post(
  '/templates/invoice/upload',
  protect,
  protect.adminOnly,
  fileUploadMiddleware,
  uploadInvoiceTemplate
);

router.delete(
  '/templates/:id',
  protect,
  protect.adminOnly,
  deleteTemplate
);

module.exports = router;