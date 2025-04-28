// src/jobs/notificationCleanup.js
const cron = require('node-cron');
const Notification = require('../models/Notification');
const safeCron = require('../utils/safeCron');
const { registerCronJob } = require('../utils/cronManager');

const startNotificationCleanupJob = () => {
  // Schedule the job to run every hour
  // This job will delete notifications that are older than 24 hours and marked as read
    const job = cron.schedule('0 * * * *', safeCron('Notification Cleanup', async () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await Notification.deleteMany({
      isRead: true,
      readAt: { $lte: cutoff }
    });

    console.log(`🧹 [Notification Cleanup] Deleted ${result.deletedCount} notifications.`);
  }));

  registerCronJob('Notification Cleanup Job', job, 'System');

};

module.exports = startNotificationCleanupJob;
