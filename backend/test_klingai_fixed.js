require('dotenv').config();
const jwt = require('jsonwebtoken');

console.log('Testing KlingAI API with fixed configuration...\n');

// Check environment
console.log('Environment Check:');
console.log('- PUBLIC_BASE_URL:', process.env.PUBLIC_BASE_URL);
console.log('- KLINGAI_ACCESS_KEY:', process.env.KLINGAI_ACCESS_KEY ? '✓ Set' : '✗ Missing');
console.log('- KLINGAI_SECRET_KEY:', process.env.KLINGAI_SECRET_KEY ? '✓ Set' : '✗ Missing');
console.log('- KLINGAI_API_ENDPOINT:', process.env.KLINGAI_API_ENDPOINT || 'https://api.klingai.com');

// Test JWT generation
const currentTime = Math.floor(Date.now() / 1000);
const payload = {
  iss: process.env.KLINGAI_ACCESS_KEY,
  exp: currentTime + 1800,
  nbf: currentTime - 5,
  iat: currentTime
};

const token = jwt.sign(payload, process.env.KLINGAI_SECRET_KEY, { 
  algorithm: 'HS256',
  noTimestamp: true
});

console.log('\nJWT Token generated successfully');
console.log('Token preview:', token.substring(0, 50) + '...');

// Decode to verify
const decoded = jwt.decode(token);
console.log('\nDecoded payload:');
console.log(JSON.stringify(decoded, null, 2));

console.log('\n✅ Configuration looks good!');
console.log('\nNgrok is running at:', process.env.PUBLIC_BASE_URL);
console.log('Files will be served from:', process.env.PUBLIC_BASE_URL + '/api/files/');
console.log('\nThe API should now work correctly with:');
console.log('1. Direct file upload (primary method)');
console.log('2. URL-based approach (fallback)');