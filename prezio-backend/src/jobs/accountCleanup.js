const cron = require('node-cron');
const User = require('../models/User');
const safeCron = require('../utils/safeCron');
const { registerCronJob } = require('../utils/cronManager');

const startAccountCleanupJob = () => {
  const schedule = '0 0 * * *'; // Midnight daily

  const job = cron.schedule(schedule, safeCron('Account Cleanup', async () => {
    const now = new Date();
    const usersToDelete = await User.find({
      terminationRequested: true,
      terminationDate: { $lte: now }
    });

    for (const user of usersToDelete) {
      // TODO: Delete other linked data (e.g., clients, quotes)
      await User.findByIdAndDelete(user._id);
      console.log(`✅ [Account Cleanup] Deleted user: ${user.email}`);
    }

    console.log(`🧹 [Account Cleanup] Finished. Total deleted: ${usersToDelete.length}`);
  }));

  registerCronJob('Account Cleanup Job', job, 'System', schedule);
};

module.exports = startAccountCleanupJob;