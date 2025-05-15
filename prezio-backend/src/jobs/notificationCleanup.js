const cron = require('node-cron');
const Notification = require('../models/Notification');
const safeCron = require('../utils/safeCron');
const { registerCronJob } = require('../utils/cronManager');

const startNotificationCleanupJob = () => {
  // Run at minute 30 of every hour to avoid potential top-of-hour congestion
  const job = cron.schedule('30 * * * *', safeCron('Notification Cleanup', async () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Add batch processing to handle large deletions more efficiently
    const result = await Notification.deleteMany({
      isRead: true,
      readAt: { $lte: cutoff }
    }).maxTimeMS(10000); // Set maximum execution time to 5 seconds

    if (result.deletedCount > 0) {
      console.log(`🧹 [Notification Cleanup] Deleted ${result.deletedCount} read notifications at ${new Date().toISOString()}`);
    }
  }));

  registerCronJob('Notification Cleanup Job', job, 'System');
};

module.exports = startNotificationCleanupJob;