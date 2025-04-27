// src/utils/safeCron.js

module.exports = function safeCron(jobName, task) {
    return async () => {
      try {
        console.log(`⏰ [${jobName}] Starting...`);
        await task();
        console.log(`✅ [${jobName}] Completed successfully.`);
      } catch (err) {
        console.error(`❌ [${jobName}] Failed:`, err);
        // Optional: Here you could send email alerts or save to a DB error log
      }
    };
  };
  