// jobs/accountCleanup.js
const cron = require('node-cron');
const User = require('../models/User');

const startAccountCleanupJob = () => {
  cron.schedule('0 0 * * *', async () => { // runs daily at midnight
    try {
      const now = new Date();
      const usersToDelete = await User.find({
        terminationRequested: true,
        terminationDate: { $lte: now }
      });

      for (const user of usersToDelete) {
        // TODO: Delete other linked data (e.g. clients, quotes)
        await User.findByIdAndDelete(user._id);
        console.log(`✅ Deleted user: ${user.email}`);
      }
    } catch (err) {
      console.error('❌ Error cleaning up users:', err);
    }
  });
};

module.exports = startAccountCleanupJob;
