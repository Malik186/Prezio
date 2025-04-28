const cron = require('node-cron');
const Client = require('../models/Client');
const safeCron = require('../utils/safeCron');
const { registerCronJob } = require('../utils/cronManager');

const startClientCleanupJob = () => {
    // Schedule the job to run every day at 1 AM
    // This job will delete clients that are older than 30 days and marked as deleted
  const job = cron.schedule('0 1 * * *', safeCron('Client Cleanup', async () => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    const result = await Client.deleteMany({
      isDeleted: true,
      deletedAt: { $lte: cutoff }
    });

    console.log(`🧹 [Client Cleanup] Deleted ${result.deletedCount} soft-deleted clients.`);
  }));

  registerCronJob('Client Cleanup Job', job, 'System');
};

module.exports = startClientCleanupJob;