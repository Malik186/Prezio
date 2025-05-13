const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { invoiceLimiter } = require('../middleware/rateLimiter');
const {
    getInvoices,
    getInvoiceById,
    editInvoice,
    softDeleteInvoice,
    createInvoice,
    getSoftDeletedInvoices,
    restoreInvoice,
    previewInvoice,
    updateInvoicePaymentStatus,
    sendInvoice,
    getOverdueInvoices,
    getInvoicePaymentHistory
} = require('../controllers/invoiceController');
const { createInvoiceSchema } = require('../validators/invoiceValidator');
const validate = require('../middleware/validateRequest');

// Apply general rate limiting to all invoice routes
router.use(invoiceLimiter);

// Basic CRUD operations
router.post('/', auth, validate(createInvoiceSchema), createInvoice);
router.get('/', auth, getInvoices);

// Specific routes (BEFORE parameter routes)
router.get('/trash', auth, getSoftDeletedInvoices);
router.get('/overdue', auth, getOverdueInvoices);

// Parameter routes
router.get('/:id', auth, getInvoiceById);
router.put('/:id', auth, editInvoice);
router.delete('/:id', auth, softDeleteInvoice);
router.get('/:id/payment-history', auth, getInvoicePaymentHistory);

// Preview route (public access with rate limiting)
router.get('/:id/preview', previewInvoice);

// Protected status update route
router.patch('/:id/status', auth, updateInvoicePaymentStatus);

// Protected email route
router.post('/:id/send', auth, sendInvoice);

// Protected restore route
router.put('/:id/restore', auth, restoreInvoice);

module.exports = router;