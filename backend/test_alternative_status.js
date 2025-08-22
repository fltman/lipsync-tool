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
    nbf: currentTime - 5
  };
  
  const headers = {
    alg: "HS256",
    typ: "JWT"
  };
  
  return jwt.sign(payload, secretKey, { header: headers });
}

async function testAlternativeStatusEndpoints() {
  console.log('=== Testing Alternative Status Endpoints ===\n');
  
  const taskId = '787834721546932317'; // Latest task ID
  const jwtToken = generateJWTToken();
  
  const client = axios.create({
    baseURL: 'https://api.klingai.com',
    timeout: 30000,
    headers: {
      'User-Agent': 'Lipsync-Tool/1.0.0'
    }
  });

  const endpointsToTry = [
    // Different endpoint variations
    `/v1/videos/lip-sync/${taskId}`,
    `/v1/videos/lip-sync/status/${taskId}`,
    `/v1/videos/lip-sync/query/${taskId}`,
    `/v1/videos/lipsync/${taskId}`,
    `/v1/video/lip-sync/${taskId}`,
    `/v1/task/${taskId}`,
    `/v1/tasks/${taskId}`,
    // POST method to status endpoint (maybe it requires POST)
  ];

  for (const endpoint of endpointsToTry) {
    console.log(`\nTrying GET ${endpoint}...`);
    
    try {
      const response = await client.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      });
      
      console.log(`✅ SUCCESS with ${endpoint}!`);
      console.log('Response:', response.data);
      return; // Stop on first success
      
    } catch (error) {
      console.log(`❌ Failed: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    }
  }

  // Try POST method to status endpoint
  console.log(`\nTrying POST to /v1/videos/lip-sync/status...`);
  
  try {
    const response = await client.post('/v1/videos/lip-sync/status', 
      { task_id: taskId },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        }
      }
    );
    
    console.log('✅ SUCCESS with POST method!');
    console.log('Response:', response.data);
    
  } catch (error) {
    console.log(`❌ POST failed: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
  }

  // Try query parameter approach
  console.log(`\nTrying query parameter approach...`);
  
  try {
    const response = await client.get('/v1/videos/lip-sync', {
      params: { task_id: taskId },
      headers: {
        'Authorization': `Bearer ${jwtToken}`
      }
    });
    
    console.log('✅ SUCCESS with query parameters!');
    console.log('Response:', response.data);
    
  } catch (error) {
    console.log(`❌ Query params failed: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
  }
}

testAlternativeStatusEndpoints();