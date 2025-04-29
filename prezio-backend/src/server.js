require('dotenv').config();
const connectDB = require('./config/db');
const app = require('./app');
const startAccountCleanupJob = require('./jobs/accountCleanup');
const startNotificationCleanupJob = require('./jobs/notificationCleanup');
const startClientCleanupJob = require('./jobs/clientCleanup');
const startQuotationCleanupJob = require('./jobs/quotationCleanup');

connectDB();

startAccountCleanupJob();        // 7-day account deletion job
startNotificationCleanupJob();   // 24hr notification cleanup job
startClientCleanupJob();        // 30-day client cleanup job
startQuotationCleanupJob();     // 30-day quotation cleanup job

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
