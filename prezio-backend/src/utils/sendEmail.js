const formData = require('form-data');
const Mailgun = require('mailgun.js');

// Initialize Mailgun client
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY
});

// Define a default sender if environment variable is missing
const DEFAULT_FROM = `Prezio App <postmaster@${process.env.MAILGUN_DOMAIN}>`;

const sendEmail = async ({ to, subject, text, html }) => {
  // Use environment variable or default sender if not available
  const fromEmail = process.env.FROM_EMAIL || DEFAULT_FROM;
  
  //console.log('Sending email with Mailgun:');
  //console.log('- Domain:', process.env.MAILGUN_DOMAIN);
  //console.log('- From:', fromEmail);
  //console.log('- To:', to);
  //console.log('- Subject:', subject);
  
  const msg = {
    from: fromEmail,
    to,
    subject,
    text: text || '',
    html: html || ''
  };

  try {
    //console.log('Making API request to Mailgun...');
    const response = await mg.messages.create(
      process.env.MAILGUN_DOMAIN,
      msg
    );
    
    console.log(`📩 Email sent successfully to ${to}`);
    return response;
  } catch (error) {
    console.error(`❌ Email failed to send: ${error.message}`);
    if (error.details) {
      console.error('Error details:', error.details);
    }
    throw error;
  }
};

module.exports = sendEmail;