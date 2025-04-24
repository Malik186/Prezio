const nodemailer = require('nodemailer');

// Create a transporter with settings that match your working PHPMailer configuration
const transporter = nodemailer.createTransport({
  host: 'mdskenya.co.ke', // Using the same host as your PHPMailer config
  port: 587,
  secure: false, // false for STARTTLS
  auth: {
    user: 'noreply@mdskenya.co.ke', // Using hyphenated version as in PHPMailer
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false, // Needed if the certificate name doesn't match
    ciphers: 'SSLv3' // Adding this for compatibility with older servers
  }
});

const sendEmail = async ({ to, subject, text, html }) => {
  const msg = {
    from: 'noreply@mdskenya.co.ke', // Using hyphenated version
    to,
    subject,
    text: text || '',
    html: html || ''
  };

  try {
    const info = await transporter.sendMail(msg);
    console.log(`📩 Email sent successfully to ${to}`);
    return info;
  } catch (error) {
    console.error(`❌ Email failed to send: ${error.message}`);
    if (error.response) {
      console.error('Error details:', error.response);
    }
    throw error;
  }
};

// Test connection on startup
transporter.verify(function (error, success) {
  if (error) {
    console.error('SMTP connection error:', error);
  } else {
    console.log('SMTP server is ready to take our messages');
  }
});

module.exports = sendEmail;