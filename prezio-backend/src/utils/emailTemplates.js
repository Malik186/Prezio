// Welcome Email Template
const createWelcomeEmail = (user, plainKey) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Prezio</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          padding: 20px 0;
          background-color: #f8f9fa;
          border-bottom: 3px solid #0066ff;
        }
        .header img {
          max-height: 60px;
        }
        .content {
          padding: 30px 20px;
          background-color: #ffffff;
        }
        .footer {
          text-align: center;
          padding: 20px;
          font-size: 12px;
          color: #666666;
          background-color: #f8f9fa;
        }
        h1 {
          color: #0066ff;
          margin-top: 0;
        }
        .key-container {
          background-color: #f7f7f7;
          border: 1px solid #e1e1e1;
          border-radius: 6px;
          padding: 15px;
          margin: 20px 0;
          text-align: center;
        }
        .key {
          font-family: monospace;
          font-size: 22px;
          letter-spacing: 2px;
          color: #0066ff;
          padding: 10px;
        }
        .button {
          display: inline-block;
          background-color: #0066ff;
          color: white;
          text-decoration: none;
          padding: 10px 20px;
          border-radius: 4px;
          margin-top: 20px;
        }
        .help-text {
          font-size: 14px;
          color: #666666;
          margin-top: 25px;
        }
        .divider {
          height: 1px;
          background-color: #e1e1e1;
          margin: 25px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://res.cloudinary.com/dqmo5qzze/image/upload/v1745590700/prezio-logo_d86yas.png" alt="Prezio Logo">
        </div>
        <div class="content">
          <h1>Welcome to Prezio! 🎉</h1>
          <p>Hi <strong>${user.name}</strong>,</p>
          <p>Thanks for signing up! We're excited to have you as a member of the Prezio community. Your account has been successfully created.</p>
          
          <div class="key-container">
            <p><strong>Your Recovery Key</strong></p>
            <p class="key">${plainKey}</p>
            <p><em>Store this key in a safe place. You'll need it if you ever lose access to your account.</em></p>
          </div>
          
          <a href="https://prezioapp.com/login" class="button">Log In to Your Account</a>
          
          <div class="divider"></div>
          
          <p class="help-text">If you have any questions or need assistance, please don't hesitate to contact our support team at <a href="mailto:support@prezioapp.com">support@prezioapp.com</a>.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Prezio. All rights reserved.</p>
          <p>Suite 34 The Stables, Karen Road, Nairobi Kenya</p>
        </div>
      </div>
    </body>
    </html>
    `;
  };
  
  // Login Detection Email Template
  const createLoginAlertEmail = (user, ip, deviceString) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Login Detected</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          padding: 20px 0;
          background-color: #f8f9fa;
          border-bottom: 3px solid #ff9900;
        }
        .header img {
          max-height: 60px;
        }
        .content {
          padding: 30px 20px;
          background-color: #ffffff;
        }
        .footer {
          text-align: center;
          padding: 20px;
          font-size: 12px;
          color: #666666;
          background-color: #f8f9fa;
        }
        h1 {
          color: #ff9900;
          margin-top: 0;
        }
        .alert-icon {
          text-align: center;
          font-size: 48px;
          margin-bottom: 20px;
        }
        .login-details {
          background-color: #f7f7f7;
          border: 1px solid #e1e1e1;
          border-radius: 6px;
          padding: 20px;
          margin: 20px 0;
        }
        .login-details table {
          width: 100%;
          border-collapse: collapse;
        }
        .login-details td {
          padding: 8px 12px;
        }
        .login-details td:first-child {
          font-weight: bold;
          width: 30%;
        }
        .button {
          display: inline-block;
          background-color: #ff9900;
          color: white;
          text-decoration: none;
          padding: 10px 20px;
          border-radius: 4px;
          margin-top: 20px;
        }
        .warning {
          background-color: #fff9e6;
          border-left: 4px solid #ff9900;
          padding: 15px;
          margin-top: 25px;
        }
        .divider {
          height: 1px;
          background-color: #e1e1e1;
          margin: 25px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://res.cloudinary.com/dqmo5qzze/image/upload/v1745590700/prezio-logo_d86yas.png" alt="Prezio Logo">
        </div>
        <div class="content">
          <div class="alert-icon">🔐</div>
          <h1>New Login Detected</h1>
          <p>Hi <strong>${user.name}</strong>,</p>
          <p>We detected a new login to your Prezio account. If this was you, no action is needed.</p>
          
          <div class="login-details">
            <table>
              <tr>
                <td>IP Address:</td>
                <td>${ip}</td>
              </tr>
              <tr>
                <td>Device:</td>
                <td>${deviceString}</td>
              </tr>
              <tr>
                <td>Time:</td>
                <td>${new Date().toLocaleString()}</td>
              </tr>
            </table>
          </div>
          
          <a href="https://prezioapp.com/account/security" class="button">Review Security Settings</a>
          
          <div class="warning">
            <p><strong>Don't recognize this activity?</strong> Please secure your account immediately by changing your password and enabling two-factor authentication.</p>
          </div>
          
          <div class="divider"></div>
          
          <p>If you need assistance, please contact our support team at <a href="mailto:support@prezioapp.com">support@prezioapp.com</a>.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Prezio. All rights reserved.</p>
          <p>Suite 34 The Stables, Karen Road, Nairobi Kenya</p>
        </div>
      </div>
    </body>
    </html>
    `;
  };
  
  // Password Reset Email Template
  const createPasswordResetEmail = (email, code) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset Code</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          padding: 20px 0;
          background-color: #f8f9fa;
          border-bottom: 3px solid #0066ff;
        }
        .header img {
          max-height: 60px;
        }
        .content {
          padding: 30px 20px;
          background-color: #ffffff;
        }
        .footer {
          text-align: center;
          padding: 20px;
          font-size: 12px;
          color: #666666;
          background-color: #f8f9fa;
        }
        h1 {
          color: #0066ff;
          margin-top: 0;
        }
        .code-container {
          background-color: #f7f7f7;
          border: 1px solid #e1e1e1;
          border-radius: 6px;
          padding: 20px;
          margin: 25px 0;
          text-align: center;
        }
        .code {
          font-family: monospace;
          font-size: 32px;
          letter-spacing: 8px;
          color: #0066ff;
          padding: 10px;
        }
        .expiry {
          color: #ff3b30;
          font-size: 14px;
          margin-top: 10px;
        }
        .divider {
          height: 1px;
          background-color: #e1e1e1;
          margin: 25px 0;
        }
        .note {
          font-size: 14px;
          background-color: #f0f7ff;
          border-left: 4px solid #0066ff;
          padding: 15px;
          margin-top: 25px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://res.cloudinary.com/dqmo5qzze/image/upload/v1745590700/prezio-logo_d86yas.png" alt="Prezio Logo">
        </div>
        <div class="content">
          <h1>Password Reset Code</h1>
          <p>Hello,</p>
          <p>We received a request to reset the password for your Prezio account associated with ${email}.</p>
          
          <div class="code-container">
            <p>Your verification code is:</p>
            <div class="code">${code}</div>
            <p class="expiry">This code will expire in 10 minutes</p>
          </div>
          
          <div class="note">
            <p>If you did not request this code, please ignore this email or contact support if you believe this is suspicious activity.</p>
          </div>
          
          <div class="divider"></div>
          
          <p>For security reasons, this code can only be used once. If you need assistance, please contact our support team at <a href="mailto:support@prezioapp.com">support@prezioapp.com</a>.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Prezio. All rights reserved.</p>
          <p>Suite 34 The Stables, Karen Road, Nairobi Kenya</p>
        </div>
      </div>
    </body>
    </html>
    `;
  };

  const createCronErrorEmail = (jobName, error, timestamp) => {
    const formattedDate = new Date(timestamp).toLocaleString('en-US', {
      dateStyle: 'medium', 
      timeStyle: 'medium'
    });
  
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cron Job Error Alert</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          padding: 20px 0;
          background-color: #f8f9fa;
          border-bottom: 3px solid #e74c3c;
        }
        .header img {
          max-height: 60px;
        }
        .content {
          padding: 30px 20px;
          background-color: #ffffff;
        }
        .footer {
          text-align: center;
          padding: 20px;
          font-size: 12px;
          color: #666666;
          background-color: #f8f9fa;
        }
        h1 {
          color: #e74c3c;
          margin-top: 0;
        }
        .error-container {
          background-color: #fff5f5;
          border: 1px solid #e74c3c;
          border-left: 5px solid #e74c3c;
          border-radius: 6px;
          padding: 15px;
          margin: 20px 0;
        }
        .error-title {
          color: #e74c3c;
          font-weight: bold;
          margin-top: 0;
        }
        .error-details {
          font-family: monospace;
          background-color: #f9f9f9;
          padding: 12px;
          border-radius: 4px;
          white-space: pre-wrap;
          overflow-x: auto;
        }
        .timestamp {
          color: #666666;
          font-style: italic;
        }
        .divider {
          height: 1px;
          background-color: #e1e1e1;
          margin: 25px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://res.cloudinary.com/dqmo5qzze/image/upload/v1745590700/prezio-logo_d86yas.png" alt="Prezio Logo">
        </div>
        <div class="content">
          <h1>⚠️ Cron Job Error Alert</h1>
          <p>A scheduled task has encountered an error and failed to complete:</p>
          
          <div class="error-container">
            <h3 class="error-title">Job: ${jobName}</h3>
            <p class="timestamp">Occurred at: ${formattedDate}</p>
            <p><strong>Error Details:</strong></p>
            <div class="error-details">${error.stack || error.message || String(error)}</div>
          </div>
          
          <p>Please investigate this issue as soon as possible to ensure system reliability.</p>
          
          <div class="divider"></div>
          
          <p>This is an automated notification from the Prezio system monitoring service.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Prezio. All rights reserved.</p>
          <p>Suite 34 The Stables, Karen Road, Nairobi Kenya</p>
        </div>
      </div>
    </body>
    </html>
    `;
  };

  const createQuotationEmail = (quotation, quotationUrl) => {
    const { 
      clientSnapshot, 
      creatorSnapshot,
      quoteNumber, 
      quoteName,
      validUntil,
      currency,
      total
    } = quotation;
  
    // Format the date
    const formattedValidUntil = new Date(validUntil).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  
    // Format the total amount
    const formattedTotal = new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: currency || 'USD' 
    }).format(total);
  
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Quotation from ${creatorSnapshot.companyName}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          padding: 20px 0;
          background-color: #f8f9fa;
          border-bottom: 3px solid #0066ff;
        }
        .header img {
          max-height: 60px;
        }
        .content {
          padding: 30px 20px;
          background-color: #ffffff;
        }
        .footer {
          text-align: center;
          padding: 20px;
          font-size: 12px;
          color: #666666;
          background-color: #f8f9fa;
        }
        h1 {
          color: #0066ff;
          margin-top: 0;
        }
        .quote-details {
          background-color: #f7f7f7;
          border: 1px solid #e1e1e1;
          border-radius: 6px;
          padding: 20px;
          margin: 25px 0;
        }
        .quote-number {
          font-family: monospace;
          font-size: 20px;
          color: #0066ff;
          margin-bottom: 10px;
        }
        .expiry {
          color: #ff3b30;
          font-size: 14px;
          margin-top: 10px;
        }
        .divider {
          height: 1px;
          background-color: #e1e1e1;
          margin: 25px 0;
        }
        .note {
          font-size: 14px;
          background-color: #f0f7ff;
          border-left: 4px solid #0066ff;
          padding: 15px;
          margin-top: 25px;
        }
        .button {
          display: inline-block;
          background-color: #0066ff;
          color: white;
          text-decoration: none;
          padding: 12px 25px;
          border-radius: 4px;
          font-weight: bold;
          margin: 20px 0;
        }
        .button:hover {
          background-color: #0055cc;
        }
        .text-center {
          text-align: center;
        }
        .company-info {
          margin-top: 20px;
          font-style: italic;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          ${creatorSnapshot.logo && creatorSnapshot.logo.url ? 
            `<img src="${creatorSnapshot.logo.url}" alt="${creatorSnapshot.companyName} Logo">` : 
            `<h2>${creatorSnapshot.companyName}</h2>`
          }
        </div>
        <div class="content">
          <h1>Quotation: ${quoteName}</h1>
          <p>Dear ${clientSnapshot.name},</p>
          <p>Thank you for your interest in our products/services. We're pleased to provide you with the following quotation:</p>
          
          <div class="quote-details">
            <div class="quote-number">Quotation Number: ${quoteNumber}</div>
            <p><strong>Total Amount:</strong> ${formattedTotal}</p>
            <p class="expiry">Valid until: ${formattedValidUntil}</p>
          </div>
          
          <div class="text-center">
            <a href="${quotationUrl}" class="button">View Complete Quotation</a>
          </div>
          
          <div class="note">
            <p>To view the detailed quotation with all product/service information, please click the button above or use the link below:</p>
            <p><a href="${quotationUrl}">${quotationUrl}</a></p>
          </div>
          
          <div class="divider"></div>
          
          <p>If you have any questions or would like to discuss this quotation further, please don't hesitate to contact us at <a href="mailto:${creatorSnapshot.email}">${creatorSnapshot.email}</a>${creatorSnapshot.phone ? ` or by phone at ${creatorSnapshot.phone}` : ''}.</p>
          
          <div class="company-info">
            <p>Best regards,</p>
            <p><strong>${creatorSnapshot.companyName}</strong></p>
            ${creatorSnapshot.address ? `<p>${creatorSnapshot.address}</p>` : ''}
          </div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${creatorSnapshot.companyName}. All rights reserved.</p>
          ${creatorSnapshot.address ? `<p>${creatorSnapshot.address}</p>` : ''}
        </div>
      </div>
    </body>
    </html>
    `;
  };
  
  module.exports = {
    createWelcomeEmail,
    createLoginAlertEmail,
    createPasswordResetEmail,
    createCronErrorEmail,
    createQuotationEmail
  };