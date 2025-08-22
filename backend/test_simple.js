const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

dotenv.config();

function testJWTGeneration() {
  const accessKey = process.env.KLINGAI_ACCESS_KEY;
  const secretKey = process.env.KLINGAI_SECRET_KEY;
  
  console.log('Access Key:', accessKey);
  console.log('Secret Key (length):', secretKey ? secretKey.length : 'not found');
  
  const currentTime = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: accessKey,
    exp: currentTime + 1800, // Valid for 30 minutes
    nbf: currentTime - 5 // Effective from 5 seconds ago
  };
  
  const headers = {
    alg: "HS256",
    typ: "JWT"
  };
  
  const token = jwt.sign(payload, secretKey, { header: headers });
  console.log('Generated JWT token:', token.substring(0, 50) + '...');
  console.log('Token payload:', jwt.decode(token));
}

testJWTGeneration();