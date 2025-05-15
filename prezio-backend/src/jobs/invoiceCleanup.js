const cron = require('node-cron');
const Invoice = require('../models/Invoice');
const safeCron = require('../utils/safeCron');
const { registerCronJob } = require('../utils/cronManager');

const startInvoiceCleanupJob = () => {
  // Runs daily at 3 AM to avoid conflict with other cleanup jobs
  const job = cron.schedule('0 3 * * *', safeCron('Invoice Cleanup', async () => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    // Find soft-deleted invoices older than cutoff date
    const result = await Invoice.deleteMany({
      isDeleted: true,
      deletedAt: { $lte: cutoff }
    });

    console.log(`🧾 [Invoice Cleanup] Permanently deleted ${result.deletedCount} soft-deleted invoices.`);

    // TODO Optional: Send admin notification for large deletions
    if (result.deletedCount > 10) {
      // TODO can add notification logic here
      console.log(`⚠️ [Invoice Cleanup] Large deletion event: ${result.deletedCount} invoices removed.`);
    }
  }));

  // Register the job with the cron manager
  registerCronJob('Invoice Cleanup Job', job, 'System');
};

module.exports = startInvoiceCleanupJob;