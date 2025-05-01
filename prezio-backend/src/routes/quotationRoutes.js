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
  sendQuotation
} = require('../controllers/quotationController');
const { createQuotationSchema } = require('../validators/quotationValidator');
const validate = require('../middleware/validateRequest');

router.post('/', auth, validate(createQuotationSchema), createQuotation);
router.get('/', auth, getQuotations);
router.put('/:id', auth, editQuotation);
router.delete('/:id', auth, softDeleteQuotation);

//preview
router.get('/:id/preview', previewQuotation);

//update status
router.patch('/:id/status', updateQuotationStatus);

// Send quotation to client via email
router.post('/:id/send', auth, sendQuotation);

// trash management
router.get('/trash', auth, getSoftDeletedQuotations);
router.put('/:id/restore', auth, restoreQuotation);

module.exports = router;