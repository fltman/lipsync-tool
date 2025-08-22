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
    nbf: currentTime - 10 // Effective from 10 seconds ago
  };
  
  const headers = {
    alg: "HS256",
    typ: "JWT"
  };
  
  return jwt.sign(payload, secretKey, { header: headers });
}

async function testImmediateStatus() {
  console.log('Testing immediate status check after submission...');
  
  const baseUrl = process.env.PUBLIC_BASE_URL || 'https://4c113f547410.ngrok-free.app';
  const videoUrl = `${baseUrl}/api/files/segment_050a195a-cab1-460e-aab8-b14f385413ff.mp4`;
  const audioUrl = `${baseUrl}/api/files/segment_050a195a-cab1-460e-aab8-b14f385413ff.wav`;
  
  const jwtToken = generateJWTToken();
  console.log('Using single JWT token for both requests');
  
  try {
    const client = axios.create({
      baseURL: 'https://api.klingai.com',
      timeout: 30000,
      headers: {
        'User-Agent': 'Lipsync-Tool/1.0.0',
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Submit task
    console.log('1. Submitting task...');
    const requestData = {
      input: {
        mode: "audio2video",
        video_url: videoUrl,
        audio_type: "url",
        audio_url: audioUrl
      }
    };
    
    const submitResponse = await client.post('/v1/videos/lip-sync', requestData);
    console.log('Submit response:', submitResponse.data);
    
    if (submitResponse.data.code === 0 && submitResponse.data.data?.task_id) {
      const taskId = submitResponse.data.data.task_id;
      console.log(`✅ Task submitted: ${taskId}`);
      
      // Immediate status check with same token
      console.log('2. Checking status immediately...');
      const statusResponse = await client.get(`/v1/videos/lip-sync/${taskId}`);
      console.log('✅ Status response:', statusResponse.data);
      
    } else {
      console.log('❌ Task submission failed');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.response?.status) {
      console.error('Response status:', error.response.status);
    }
  }
}

testImmediateStatus();