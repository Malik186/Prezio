const express = require('express');
const { listCronJobs } = require('../utils/cronManager');
const { uploadTemplate } = require('../controllers/admin/templateController');
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

module.exports = router;