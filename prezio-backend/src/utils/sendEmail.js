const { Resend } = require('resend');

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Define a default sender if environment variable is missing
const DEFAULT_FROM = process.env.FROM_EMAIL || 'Prezio App <info@mdskenya.com>';

const sendEmail = async ({ to, subject, text, html }) => {
  //console.log('Sending email with Resend:');
  //console.log('- From:', DEFAULT_FROM);
  //console.log('- To:', to);
  //console.log('- Subject:', subject);
  
  const msg = {
    from: DEFAULT_FROM,
    to,
    subject,
    text: text || '',
    html: html || ''
  };

  try {
    const response = await resend.emails.send(msg);
    
    //console.log(`📩 Email sent successfully to ${to}`);
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