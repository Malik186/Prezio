const Joi = require('joi');

const receiptItemSchema = Joi.object({
  description: Joi.string().required(),
  quantity: Joi.number().min(1).required(),
  unitPrice: Joi.number().min(0).required(),
  discount: Joi.number().min(0).default(0),
  type: Joi.object({
    category: Joi.string().valid('Service', 'Product', 'Other').required(),
    otherName: Joi.when('category', {
      is: 'Other',
      then: Joi.string().required().messages({
        'any.required': 'Custom type name required when category is "Other"',
      }),
      otherwise: Joi.forbidden()
    })
  }).required()
});

// Payment Details
const paymentSchema = Joi.object({
  method: Joi.string().valid('mpesa', 'bank').required(),
  mpesa: Joi.object({
    type: Joi.string().valid('paybill', 'sendMoney').required(),
    paybill: Joi.object({
      tillNumber: Joi.string().required()
    }).optional(),
    sendMoney: Joi.object({
      phoneNumber: Joi.string().required(),
      isNewNumber: Joi.boolean().default(false)
    }).optional()
  }).optional(),
  bank: Joi.object({
    bankName: Joi.string().required(),
    accountNumber: Joi.string().required()
  }).optional(),
  status: Joi.string().valid('pending', 'partial', 'paid', 'overdue', 'canceled').default('pending'),
  datePaid: Joi.date().optional(),
  amountPaid: Joi.number().min(0).required()
});

// Schema for Manual Receipt Creation
const createManualReceiptSchema = Joi.object({
  receiptName: Joi.string().optional(),
  receiptTitle: Joi.string().optional(),  
  notes: Joi.string().optional(),         
  paymentPurpose: Joi.string().optional(), 
  client: Joi.string().length(24).required(),
  items: Joi.array().items(receiptItemSchema).min(1).required(),
  currency: Joi.string().valid('KSH', 'TSH', 'USH', 'USD', 'EUR').required(),
  template: Joi.string().length(24).required(),
  payment: paymentSchema.required()
});

// Schema for Linked to Invoice Receipt Creation
const createLinkedReceiptSchema = Joi.object({
  invoice: Joi.string().length(24).required(), // Invoice ID
  template: Joi.string().length(24).required(),
  receiptTitle: Joi.string().optional(), 
  notes: Joi.string().optional(),         
  paymentPurpose: Joi.string().optional(), 
  payment: paymentSchema.required()
});

module.exports = {
  createManualReceiptSchema,
  createLinkedReceiptSchema
};