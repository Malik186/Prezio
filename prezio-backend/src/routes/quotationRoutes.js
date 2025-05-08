const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const {
  getQuotations,
  editQuotation,
  softDeleteQuotation,
  createQuotation,
  getSoftDeletedQuotations,
  restoreQuotation,
  previewQuotation,
  updateQuotationStatus,
  sendQuotation,
  getExpiredQuotations
} = require('../controllers/quotationController');
const { createQuotationSchema } = require('../validators/quotationValidator');
const validate = require('../middleware/validateRequest');

router.post('/', auth, validate(createQuotationSchema), createQuotation);
router.get('/', auth, getQuotations);

// Place specific routes BEFORE parameter routes
// trash management
router.get('/trash', auth, getSoftDeletedQuotations);
// Get all expired quotations
router.get('/expired', auth, getExpiredQuotations);

// Routes with parameters come after specific routes
router.put('/:id', auth, editQuotation);
router.delete('/:id', auth, softDeleteQuotation);

//preview
router.get('/:id/preview', previewQuotation);

//update status
router.patch('/:id/status', updateQuotationStatus);

// Send quotation to client via email
router.post('/:id/send', auth, sendQuotation);

// Restore a soft-deleted quotation
router.put('/:id/restore', auth, restoreQuotation);

module.exports = router;