const cron = require('node-cron');
const Quotation = require('../models/Quotation');
const safeCron = require('../utils/safeCron');
const { registerCronJob } = require('../utils/cronManager');
const { logActivity } = require('../utils/activityLogger');

const startQuotationCleanupJob = () => {
  const schedule = '0 2 * * *'; // 2 AM daily

  const job = cron.schedule(schedule, safeCron('Quotation Cleanup', async () => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    const result = await Quotation.deleteMany({
      isDeleted: true,
      deletedAt: { $lte: cutoff }
    });
    // Log the cleanup activity
    await logActivity({
      action: 'QUOTATION_CLEANUP',
      description: 'Quotation cleanup job executed',
      details: {
        deletedQuotations: result.deletedCount
      },
      ip: 'Cron Job',
      userAgent: 'Cron Job'
    });
    console.log(`🧾 [Quotation Cleanup] Deleted ${result.deletedCount} soft-deleted quotations.`);
  }));

  registerCronJob('Quotation Cleanup Job', job, 'System', schedule);
};

module.exports = startQuotationCleanupJob;