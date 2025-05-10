/**
 * Generate receipt number in format RCPT-YYYY-MM-XXXXX
 * @param {Number} sequentialNumber - The sequential receipt number
 * @returns {String} - Formatted receipt number
 */
function generateReceiptNumber(sequentialNumber) {
  const today = new Date();
  
  // Extract year and month
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  
  // Format the sequential number with leading zeros (5 digits)
  const formattedNumber = String(sequentialNumber).padStart(5, '0');
  
  // Combine into the format RCPT-YYYY-MM-XXXXX
  return `RCPT-${year}-${month}-${formattedNumber}`;
}

module.exports = generateReceiptNumber;