const axios = require('axios');
const fs = require('fs');

// Make the 2FA generate request
axios.get('http://localhost:5000/api/two-factor/generate', {
  headers: {
    Cookie: 'token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4MGI4YzdjZDIyYTliZjkzMGIwZjZiMCIsImlhdCI6MTc0NTY1ODYzNSwiZXhwIjoxNzQ2MjYzNDM1fQ.gE4fQe9aHYlsBER4qSQBucsFJp5HWdlCW47TxGAPfKc'// No harm already expired
  }
})
.then(response => {
  // Save the QR code to a file
  const qrCodeBase64 = response.data.qrCode.split(',')[1];
  fs.writeFileSync('qrcode.png', Buffer.from(qrCodeBase64, 'base64'));
  console.log('QR Code saved to qrcode.png');
  console.log('Manual Entry Key:', response.data.manualEntryKey);
})
.catch(error => {
  console.error('Error:', error.response?.data || error.message);
});