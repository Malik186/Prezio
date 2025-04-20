// utils/generateRecoveryPDF.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateRecoveryPDF = async ({ name, email, recoveryKey }) => {
  const doc = new PDFDocument();
  const filePath = path.join(__dirname, '..', 'temp', `recovery_${Date.now()}.pdf`);
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  doc.fontSize(22).text('Prezio Recovery Key', { align: 'center' });
  doc.moveDown();

  doc.fontSize(16).text(`Hello ${name},`);
  doc.moveDown();
  doc.text(`This is your secure Prezio recovery key. Keep it somewhere safe and do not share it with anyone.`);
  doc.moveDown();

  doc.fontSize(18).text(`🔐 Recovery Key:`, { underline: true });
  doc.fontSize(20).text(`${recoveryKey}`, { align: 'center', oblique: true });
  doc.moveDown();

  doc.fontSize(12).text(`Email: ${email}`);
  doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
};

module.exports = generateRecoveryPDF;
