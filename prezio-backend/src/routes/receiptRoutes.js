const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const validate = require('../middleware/validateRequest');
const {
    createReceipt,
    getReceipts,
    getReceiptById,
    softDeleteReceipt,
    getSoftDeletedReceipts,
    restoreReceipt,
    previewReceipt,
    sendReceiptToClient,
    getReceiptsByInvoice
} = require('../controllers/receiptController');
const {
    createManualReceiptSchema,
    createLinkedReceiptSchema
} = require('../validators/receiptValidator');

// Create a receipt manually
router.post('/manual', auth, validate(createManualReceiptSchema), createReceipt);

// Create a receipt linked to an invoice
router.post('/linked', auth, validate(createLinkedReceiptSchema), createReceipt);

// Get all receipts
router.get('/', auth, getReceipts);

// Trash management
router.get('/trash', auth, getSoftDeletedReceipts);

// Get receipts by invoice ID
router.get('/invoice/:invoiceId', getReceiptsByInvoice);

// Get receipt by ID
router.get('/:id', auth, getReceiptById);

// Soft delete receipt by ID
router.delete('/:id', auth, softDeleteReceipt);

// Preview receipt
router.get('/:id/preview', previewReceipt);

// Send receipt to client via email
router.post('/:id/send', auth, sendReceiptToClient);

// Restore soft-deleted receipt
router.put('/:id/restore', auth, restoreReceipt);

module.exports = router;
