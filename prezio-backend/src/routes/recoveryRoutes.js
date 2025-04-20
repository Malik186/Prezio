const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// GET /recovery/:filename → serve PDF from /temp
router.get('/:filename', (req, res) => {
  const fileName = req.params.filename;
  const filePath = path.join(__dirname, '..', 'temp', fileName);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Recovery PDF not found or expired.' });
  }

  res.download(filePath, fileName, (err) => {
    if (err) {
      console.error('PDF download error:', err);
      return res.status(500).json({ message: 'Error downloading recovery key.' });
    }
  });
});

module.exports = router;
