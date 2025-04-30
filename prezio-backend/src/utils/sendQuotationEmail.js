// utils/sendQuotationEmail.js
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendQuotationEmail(to, subject, html) {
  await resend.emails.send({
    from: 'Prezio App <quotations@mdskenya.com>',
    to,
    subject,
    html
  });
}

module.exports = sendQuotationEmail;
