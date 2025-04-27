// src/jobs/notificationCleanup.js
const cron = require('node-cron');
const Notification = require('../models/Notification');

const startNotificationCleanupJob = () => {
  // This will run at minute 0 of every hour
  cron.schedule('0 * * * *', async () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    try {
      const result = await Notification.deleteMany({
        isRead: true,
        readAt: { $lte: cutoff }
      });

      if (result.deletedCount > 0) {
        //console.log(`✅ [Notification Cleanup] Deleted ${result.deletedCount} old read notifications.`);
      } else {
        //console.log('ℹ️ [Notification Cleanup] No old read notifications found.');
      }
    } catch (err) {
      console.error('❌ [Notification Cleanup] Failed to delete old notifications:', err);
    }
  });
};

module.exports = startNotificationCleanupJob;
