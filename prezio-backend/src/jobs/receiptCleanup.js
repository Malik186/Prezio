const cron = require('node-cron');
const Receipt = require('../models/Receipt');
const safeCron = require('../utils/safeCron');
const { registerCronJob } = require('../utils/cronManager');

const startReceiptCleanupJob = () => {
  // Runs daily at 4 AM to avoid conflict with other cleanup jobs
  const job = cron.schedule('0 4 * * *', safeCron('Receipt Cleanup', async () => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    // Find and delete soft-deleted receipts older than cutoff date
    const result = await Receipt.deleteMany({
      isDeleted: true,
      deletedAt: { $lte: cutoff }
    });

    console.log(`🧾 [Receipt Cleanup] Permanently deleted ${result.deletedCount} soft-deleted receipts.`);

    //  TODO Optional: Send admin notification for large deletions
    if (result.deletedCount > 10) {
      console.log(`⚠️ [Receipt Cleanup] Large deletion event: ${result.deletedCount} receipts removed.`);
    }
  }));

  // Register the job with the cron manager
  registerCronJob('Receipt Cleanup Job', job, 'System');
};

module.exports = startReceiptCleanupJob;