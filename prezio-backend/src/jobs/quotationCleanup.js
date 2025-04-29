const cron = require('node-cron');
const Quotation = require('../models/Quotation');
const safeCron = require('../utils/safeCron');
const { registerCronJob } = require('../utils/cronManager');

const startQuotationCleanupJob = () => {
  // Runs daily at 2 AM to avoid conflict with the client cleanup at 1 AM
  const job = cron.schedule('0 2 * * *', safeCron('Quotation Cleanup', async () => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    const result = await Quotation.deleteMany({
      isDeleted: true,
      deletedAt: { $lte: cutoff }
    });

    console.log(`🧾 [Quotation Cleanup] Deleted ${result.deletedCount} soft-deleted quotations.`);
  }));

  registerCronJob('Quotation Cleanup Job', job, 'System');
};

module.exports = startQuotationCleanupJob;
