const Joi = require('joi');

const lineItemSchema = Joi.object({
  description: Joi.string().required(),
  quantity: Joi.number().min(1).required(),
  unitPrice: Joi.number().min(0).required(),
  applyTax: Joi.boolean().default(false),
  type: Joi.object({
    category: Joi.string().valid('Service', 'Product', 'Other').required(),
    otherName: Joi.when('category', {
      is: 'Other',
      then: Joi.string().trim().required().messages({
        'any.required': 'Custom type name is required for "Other"',
      }),
      otherwise: Joi.forbidden()
    })
  }).required()
});

const createQuotationSchema = Joi.object({
  quoteName: Joi.string().required().messages({ 'any.required': 'Quote name is required' }),
  validUntil: Joi.date().required(),
  template: Joi.string().length(24).required(), // MongoDB ObjectId
  client: Joi.string().length(24).required(), // MongoDB ObjectId
  lineItems: Joi.array().items(lineItemSchema).min(1).required(),
  discount: Joi.number().min(0).default(0),
  currency: Joi.string().valid('KSH', 'TSH', 'USH', 'USD', 'EUR').required()
});

module.exports = {
  createQuotationSchema
};
