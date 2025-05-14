/**
 * Utility function to record payment history consistently across the application
 */
const recordPaymentHistory = async (invoice, {
  amountPaid,
  previousAmount = 0,
  paymentMethod,
  paymentDetails,
  notes,
  datePaid,
  userId
}) => {
  // Initialize payment history if needed
  if (!invoice.paymentHistory) {
    invoice.paymentHistory = [];
  }

  // For new payments, use the full amount
  const newPaymentAmount = amountPaid;

  // Validate the new payment amount
  if (newPaymentAmount < 5) {
    throw new Error(`Payment amount must be at least 5 ${invoice.currency}`);
  }

  // Create payment entry
  const paymentEntry = {
    date: datePaid || new Date(),
    amount: newPaymentAmount,
    method: paymentMethod,
    paymentDetails: paymentDetails || {},
    notes: notes || `Payment of ${newPaymentAmount} ${invoice.currency}`,
    createdBy: userId
  };

  // Add to history
  invoice.paymentHistory.push(paymentEntry);

  return paymentEntry;
};

module.exports = { recordPaymentHistory };