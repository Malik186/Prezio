const asyncHandler = require('express-async-handler');
const Quotation = require('../models/Quotation');
const Template = require('../models/Template');
const puppeteer = require('puppeteer');
const hbs = require('handlebars');
const path = require('path');
const fs = require('fs');

exports.downloadQuotationPDF = asyncHandler(async (req, res) => {
  const quotationId = req.params.id;
  const quotation = await Quotation.findById(quotationId).populate('template');
  if (!quotation) return res.status(404).json({ message: 'Quotation not found' });

  const templatePath = path.join(__dirname, '../templates', quotation.template.fileName);
  const templateHtml = fs.readFileSync(templatePath, 'utf-8');

  const compiledTemplate = hbs.compile(templateHtml);
  const html = compiledTemplate(quotation.toObject());

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({ format: 'A4' });

  await browser.close();

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename=Quotation-${quotation.quoteNumber}.pdf`,
    'Content-Length': pdfBuffer.length
  });

  res.send(pdfBuffer);
});
