// utils/generateQuoteNumber.js
const generateQuoteNumber = (lastNumber = 0) => {
    const next = lastNumber + 1;
    return String(next).padStart(5, '0'); // ensures 5-digit format like "00001"
  };
  
  module.exports = generateQuoteNumber;
  