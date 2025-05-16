const cron = require('node-cron');
const Client = require('../models/Client');
const safeCron = require('../utils/safeCron');
const { registerCronJob } = require('../utils/cronManager');
const { logActivity } = require('../utils/activityLogger');

const startClientCleanupJob = () => {
  const schedule = '0 1 * * *'; // 1 AM daily

  const job = cron.schedule(schedule, safeCron('Client Cleanup', async () => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    const result = await Client.deleteMany({
      isDeleted: true,
      deletedAt: { $lte: cutoff }
    });

    // Log the cleanup activity
    await logActivity({
      action: 'CLIENT_CLEANUP',
      description: 'Client cleanup job executed',
      details: {
        deletedClients: result.deletedCount
      },
      ip: 'Cron Job',
      userAgent: 'Cron Job'
    });

    console.log(`🧹 [Client Cleanup] Deleted ${result.deletedCount} soft-deleted clients.`);
  }));

  registerCronJob('Client Cleanup Job', job, 'System', schedule);
};

module.exports = startClientCleanupJob;