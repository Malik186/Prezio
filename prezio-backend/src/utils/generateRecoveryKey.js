// src/utils/generateRecoveryKey.js
const crypto = require('crypto');

const generateRecoveryKey = () => {
  return crypto.randomBytes(24).toString('hex'); // ~32 char
};

module.exports = generateRecoveryKey;
// This function generates a random recovery key using the crypto module. It creates a buffer of 24 random bytes and converts it to a hexadecimal string, resulting in a string of approximately 32 characters. This key can be used for password recovery.
// The generated key is exported as a module so it can be used in other parts of the application, such as when creating a password reset request or when generating a recovery key for a user.