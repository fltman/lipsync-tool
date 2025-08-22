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

async function testRealKlingAI() {
  console.log('Testing real KlingAI API...');
  
  const baseUrl = process.env.PUBLIC_BASE_URL || 'https://4c113f547410.ngrok-free.app';
  const videoUrl = `${baseUrl}/api/files/segment_050a195a-cab1-460e-aab8-b14f385413ff.mp4`;
  const audioUrl = `${baseUrl}/api/files/segment_050a195a-cab1-460e-aab8-b14f385413ff.wav`;
  
  console.log('Video URL:', videoUrl);
  console.log('Audio URL:', audioUrl);
  
  const jwtToken = generateJWTToken();
  console.log('JWT Token:', jwtToken.substring(0, 50) + '...');
  
  try {
    const client = axios.create({
      baseURL: 'https://api.klingai.com',
      timeout: 30000,
      headers: {
        'User-Agent': 'Lipsync-Tool/1.0.0'
      }
    });

    const requestData = {
      input: {
        mode: "audio2video",
        video_url: videoUrl,
        audio_type: "url",
        audio_url: audioUrl
      }
    };

    console.log('Request payload:');
    console.log(JSON.stringify(requestData, null, 2));
    
    const response = await client.post('/v1/videos/lip-sync', requestData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
        'ngrok-skip-browser-warning': 'true'
      }
    });

    console.log('API Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.code === 0 && response.data.data?.task_id) {
      console.log('✅ Task submitted successfully:', response.data.data.task_id);
      
      // Test status check
      console.log('\nTesting status check...');
      const statusResponse = await client.get(`/v1/videos/lip-sync/${response.data.data.task_id}`, {
        headers: {
          'Authorization': `Bearer ${generateJWTToken()}`
        }
      });
      
      console.log('Status Response:');
      console.log(JSON.stringify(statusResponse.data, null, 2));
      
    } else {
      console.log('❌ Unexpected response format');
    }
    
  } catch (error) {
    console.error('❌ API Error:', error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.response?.status) {
      console.error('Response status:', error.response.status);
    }
  }
}

testRealKlingAI();