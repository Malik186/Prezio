const cron = require('node-cron');
const Invoice = require('../models/Invoice');
const safeCron = require('../utils/safeCron');
const { registerCronJob } = require('../utils/cronManager');

const startInvoiceCleanupJob = () => {
  const schedule = '0 3 * * *'; // 3 AM daily

  const job = cron.schedule(schedule, safeCron('Invoice Cleanup', async () => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    const result = await Invoice.deleteMany({
      isDeleted: true,
      deletedAt: { $lte: cutoff }
    });

    console.log(`🧾 [Invoice Cleanup] Permanently deleted ${result.deletedCount} soft-deleted invoices.`);

    if (result.deletedCount > 10) {
      console.log(`⚠️ [Invoice Cleanup] Large deletion event: ${result.deletedCount} invoices removed.`);
    }
  }));

  registerCronJob('Invoice Cleanup Job', job, 'System', schedule);
};

module.exports = startInvoiceCleanupJob;