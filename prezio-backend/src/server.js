// src/server.js
require('dotenv').config();
const connectDB = require('./config/db');
const app = require('./app');
const startAccountCleanupJob = require('./jobs/accountCleanup');

connectDB();

startAccountCleanupJob(); // Start the account cleanup job


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
