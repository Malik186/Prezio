const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
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
    getOverdueInvoices
} = require('../controllers/invoiceController');
const { createInvoiceSchema } = require('../validators/invoiceValidator');
const validate = require('../middleware/validateRequest');

router.post('/', auth, validate(createInvoiceSchema), createInvoice);
router.get('/', auth, getInvoices);

// IMPORTANT: Place specific routes BEFORE parameter routes
// trash management
router.get('/trash', auth, getSoftDeletedInvoices);
// Get all Overdue invoices
router.get('/overdue', auth, getOverdueInvoices);

// Routes with parameters come after specific routes
router.get('/:id', auth, getInvoiceById);
router.put('/:id', auth, editInvoice);
router.delete('/:id', auth, softDeleteInvoice);

//preview
router.get('/:id/preview', previewInvoice);

//update status
router.patch('/:id/status', updateInvoicePaymentStatus);

// Send invoice to client via email
router.post('/:id/send', auth, sendInvoice);

router.put('/:id/restore', auth, restoreInvoice);

module.exports = router;