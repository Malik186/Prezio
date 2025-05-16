const cron = require('node-cron');
const Notification = require('../models/Notification');
const safeCron = require('../utils/safeCron');
const { registerCronJob } = require('../utils/cronManager');

const startNotificationCleanupJob = () => {
  const schedule = '30 * * * *'; // Minute 30 of every hour

  const job = cron.schedule(schedule, safeCron('Notification Cleanup', async () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await Notification.deleteMany({
      isRead: true,
      readAt: { $lte: cutoff }
    }).maxTimeMS(10000);

    if (result.deletedCount > 0) {
      console.log(`🧹 [Notification Cleanup] Deleted ${result.deletedCount} read notifications at ${new Date().toISOString()}`);
    }
  }));

  registerCronJob('Notification Cleanup Job', job, 'System', schedule);
};

module.exports = startNotificationCleanupJob;