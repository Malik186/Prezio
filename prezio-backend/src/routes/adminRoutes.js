const express = require('express');
const { listCronJobs } = require('../utils/cronManager');
const protect = require('../middleware/authMiddleware');
const router = express.Router();

// Example: GET /api/admin/cron-jobs
router.get('/cron-jobs', protect, protect.adminOnly, (req, res) => {
  const jobs = listCronJobs();
  res.status(200).json(jobs);
});

module.exports = router;