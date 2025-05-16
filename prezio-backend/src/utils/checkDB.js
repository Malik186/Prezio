const mongoose = require('mongoose');

const checkDBConnection = async () => {
  const status = mongoose.connection.readyState;
  const statusMap = ['disconnected', 'connected', 'connecting', 'disconnecting'];

  return {
    status: statusMap[status] || 'unknown',
    ping: Math.floor(Math.random() * 50) + 10 // Simulated ping (ms)
  };
};

module.exports = checkDBConnection;
