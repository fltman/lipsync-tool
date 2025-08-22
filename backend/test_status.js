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
    exp: currentTime + 1800, // Valid for 30 minutes
    nbf: currentTime - 5 // Effective from 5 seconds ago
  };
  
  const headers = {
    alg: "HS256",
    typ: "JWT"
  };
  
  return jwt.sign(payload, secretKey, { header: headers });
}

async function testStatusCheck() {
  console.log('Testing KlingAI status check...');
  
  const taskId = '787833882569359458'; // Use the task ID from previous test
  
  const jwtToken = generateJWTToken();
  console.log('JWT Token:', jwtToken.substring(0, 50) + '...');
  console.log('Task ID:', taskId);
  
  try {
    const client = axios.create({
      baseURL: 'https://api.klingai.com',
      timeout: 30000,
      headers: {
        'User-Agent': 'Lipsync-Tool/1.0.0'
      }
    });

    console.log(`Making GET request to: /v1/videos/lip-sync/${taskId}`);
    
    const response = await client.get(`/v1/videos/lip-sync/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${jwtToken}`
      }
    });

    console.log('✅ Status Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ API Error:', error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.response?.status) {
      console.error('Response status:', error.response.status);
    }
    if (error.config) {
      console.error('Request URL:', error.config.baseURL + error.config.url);
      console.error('Request headers:', error.config.headers);
    }
  }
}

testStatusCheck();