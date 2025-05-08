const Joi = require('joi');

// Line item validation
const lineItemSchema = Joi.object({
  description: Joi.string().required(),
  quantity: Joi.number().min(1).required(),
  unitPrice: Joi.number().min(0).required(),
  discount: Joi.number().min(0).default(0),
  type: Joi.object({
    category: Joi.string().valid('Service', 'Product', 'Other').required(),
    otherName: Joi.when('category', {
      is: 'Other',
      then: Joi.string().trim().required().messages({
        'any.required': 'Custom type name is required when category is "Other"',
      }),
      otherwise: Joi.forbidden()
    })
  }).required()
});

// Mpesa paybill validation
const mpesaPaybillSchema = Joi.object({
  tillNumber: Joi.string().required()
});

// Mpesa sendMoney validation
const mpesaSendMoneySchema = Joi.object({
  phoneNumber: Joi.string().required(),
  isNewNumber: Joi.boolean().default(false)
});

// Mpesa schema
const mpesaSchema = Joi.object({
  type: Joi.string().valid('paybill', 'sendMoney').required(),
  paybill: mpesaPaybillSchema.optional(),
  sendMoney: mpesaSendMoneySchema.optional()
});

// Bank schema
const bankSchema = Joi.object({
  bankName: Joi.string().required(),
  accountNumber: Joi.string().required()
});

// Payment Details
const paymentDetailsSchema = Joi.object({
  method: Joi.string().valid('mpesa', 'bank').required(),
  mpesa: mpesaSchema.optional(),
  bank: bankSchema.optional(),
  status: Joi.string().valid('pending', 'partial', 'paid', 'overdue', 'canceled').default('pending'),
  datePaid: Joi.date().optional(),
  amountPaid: Joi.number().min(0).default(0)
});

// Create Invoice Schema
const createInvoiceSchema = Joi.object({
  invoiceName: Joi.string().required().messages({ 'any.required': 'Invoice name is required' }),
  projectDescription: Joi.string().required().messages({ 'any.required': 'Project description is required' }),
  notes: Joi.string().allow('').optional(),
  dueDate: Joi.date().required(),
  template: Joi.string().length(24).required(), // MongoDB ObjectId
  client: Joi.string().length(24).required(),   // MongoDB ObjectId
  lineItems: Joi.array().items(lineItemSchema).min(1).required(),
  discount: Joi.number().min(0).default(0),
  currency: Joi.string().valid('KSH', 'TSH', 'USH', 'USD', 'EUR').required(),
  payment: paymentDetailsSchema.optional(),
  quotation: Joi.string().length(24).optional() // Related quotation if linked
});

module.exports = {
  createInvoiceSchema
};
