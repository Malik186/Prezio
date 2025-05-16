const cron = require('node-cron');
const Receipt = require('../models/Receipt');
const safeCron = require('../utils/safeCron');
const { registerCronJob } = require('../utils/cronManager');
const { logActivity } = require('../utils/activityLogger');

// This job permanently deletes receipts that have been soft-deleted for more than 30 days.
// It runs daily at 4 AM.
const startReceiptCleanupJob = () => {
  const schedule = '0 4 * * *'; // 4 AM daily

  const job = cron.schedule(schedule, safeCron('Receipt Cleanup', async () => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    const result = await Receipt.deleteMany({
      isDeleted: true,
      deletedAt: { $lte: cutoff }
    });
    // Log the cleanup activity
    await logActivity({
      action: 'RECEIPT_CLEANUP',
      description: 'Receipt cleanup job executed',
      details: {
        deletedReceipts: result.deletedCount
      },
      ip: 'Cron Job',
      userAgent: 'Cron Job'
    });
    console.log(`🧾 [Receipt Cleanup] Permanently deleted ${result.deletedCount} soft-deleted receipts.`);

    // Log a warning if more than 10 receipts are deleted at once
    // This is to prevent accidental mass deletions.
    if (result.deletedCount > 10) {
      console.log(`⚠️ [Receipt Cleanup] Large deletion event: ${result.deletedCount} receipts removed.`);
    }
  }));

  registerCronJob('Receipt Cleanup Job', job, 'System', schedule);
};

module.exports = startReceiptCleanupJob;
