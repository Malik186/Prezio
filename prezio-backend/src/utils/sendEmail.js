const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async ({ to, subject, text, html }) => {
  const msg = {
    to,
    from: process.env.FROM_EMAIL,
    subject,
    text,
    html,
  };

  try {
    await sgMail.send(msg);
    console.log(`📩 Email sent to ${to}`);
  } catch (error) {
    console.error(`❌ Email failed to send: ${error.response?.body || error.message}`);
  }
};

module.exports = sendEmail;
