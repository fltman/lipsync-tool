const axios = require('axios');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

function generateJWTToken() {
  const accessKey = process.env.KLINGAI_ACCESS_KEY;
  const secretKey = process.env.KLINGAI_SECRET_KEY;
  const currentTime = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: accessKey,
    exp: currentTime + 1800,
    nbf: currentTime - 10
  };
  
  const headers = {
    alg: "HS256",
    typ: "JWT"
  };
  
  return jwt.sign(payload, secretKey, { header: headers });
}

async function testDifferentHeaders() {
  const taskId = '787834087024230432'; // Use latest task
  const jwtToken = generateJWTToken();
  
  const tests = [
    {
      name: "With Content-Type application/json",
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Lipsync-Tool/1.0.0'
      }
    },
    {
      name: "Without Content-Type",
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'User-Agent': 'Lipsync-Tool/1.0.0'
      }
    },
    {
      name: "Minimal headers only",
      headers: {
        'Authorization': `Bearer ${jwtToken}`
      }
    }
  ];
  
  for (const test of tests) {
    console.log(`\n--- Testing: ${test.name} ---`);
    
    try {
      const client = axios.create({
        baseURL: 'https://api.klingai.com',
        timeout: 30000
      });

      const response = await client.get(`/v1/videos/lip-sync/${taskId}`, {
        headers: test.headers
      });

      console.log('✅ Success!');
      console.log('Response:', response.data);
      
    } catch (error) {
      console.error(`❌ Failed: ${error.message}`);
      if (error.response?.data) {
        console.error('Error data:', error.response.data);
      }
    }
  }
}

testDifferentHeaders();