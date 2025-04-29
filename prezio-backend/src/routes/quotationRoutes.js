const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const {
  getQuotations,
  editQuotation,
  softDeleteQuotation,
  createQuotation,
  getSoftDeletedQuotations,
  restoreQuotation
} = require('../controllers/quotationController');
const { createQuotationSchema } = require('../validators/quotationValidator');
const validate = require('../middleware/validateRequest');


router.post('/', auth, validate(createQuotationSchema), createQuotation);
router.get('/', auth, getQuotations);
router.put('/:id', auth, editQuotation);
router.delete('/:id', auth, softDeleteQuotation);

// trash management
router.get('/trash', auth, getSoftDeletedQuotations);
router.put('/:id/restore', auth, restoreQuotation);

module.exports = router;