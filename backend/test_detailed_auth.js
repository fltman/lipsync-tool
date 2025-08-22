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
    exp: currentTime + 1800, // 30 minutes from now
    nbf: currentTime - 5 // 5 seconds ago
  };
  
  const headers = {
    alg: "HS256",
    typ: "JWT"
  };
  
  const token = jwt.sign(payload, secretKey, { header: headers });
  
  console.log('Token generation details:');
  console.log('- Access Key:', accessKey);
  console.log('- Secret Key length:', secretKey.length);
  console.log('- Current timestamp:', currentTime);
  console.log('- Token nbf (valid from):', payload.nbf);
  console.log('- Token exp (valid until):', payload.exp);
  console.log('- Token valid for:', (payload.exp - currentTime), 'seconds');
  console.log('- Token:', token.substring(0, 50) + '...');
  console.log('- Decoded payload:', jwt.decode(token));
  
  return token;
}

async function testAuthenticationDetails() {
  console.log('=== Testing KlingAI Authentication Details ===\n');
  
  const baseUrl = process.env.PUBLIC_BASE_URL || 'https://4c113f547410.ngrok-free.app';
  const videoUrl = `${baseUrl}/api/files/segment_050a195a-cab1-460e-aab8-b14f385413ff.mp4`;
  const audioUrl = `${baseUrl}/api/files/segment_050a195a-cab1-460e-aab8-b14f385413ff.wav`;
  
  const jwtToken = generateJWTToken();
  
  const client = axios.create({
    baseURL: 'https://api.klingai.com',
    timeout: 30000,
    headers: {
      'User-Agent': 'Lipsync-Tool/1.0.0'
    }
  });

  try {
    // Test 1: Submit a new task
    console.log('\n1. Testing task submission...');
    const submitData = {
      input: {
        mode: "audio2video",
        video_url: videoUrl,
        audio_type: "url",
        audio_url: audioUrl
      }
    };
    
    const submitResponse = await client.post('/v1/videos/lip-sync', submitData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      }
    });
    
    console.log('✅ Task submission successful!');
    console.log('Response code:', submitResponse.data.code);
    console.log('Task ID:', submitResponse.data.data?.task_id);
    
    const taskId = submitResponse.data.data?.task_id;
    
    if (taskId) {
      // Test 2: Wait 2 seconds then check status with SAME token
      console.log('\n2. Waiting 2 seconds then checking status with same token...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        const statusResponse = await client.get(`/v1/videos/lip-sync/${taskId}`, {
          headers: {
            'Authorization': `Bearer ${jwtToken}`
          }
        });
        
        console.log('✅ Status check successful!');
        console.log('Status response:', statusResponse.data);
        
      } catch (statusError) {
        console.log('❌ Status check failed with same token');
        console.log('Status error code:', statusError.response?.data?.code);
        console.log('Status error message:', statusError.response?.data?.message);
        
        // Test 3: Generate fresh token for status check
        console.log('\n3. Trying with fresh token...');
        const freshToken = generateJWTToken();
        
        try {
          const freshStatusResponse = await client.get(`/v1/videos/lip-sync/${taskId}`, {
            headers: {
              'Authorization': `Bearer ${freshToken}`
            }
          });
          
          console.log('✅ Status check with fresh token successful!');
          console.log('Fresh status response:', freshStatusResponse.data);
          
        } catch (freshError) {
          console.log('❌ Status check failed even with fresh token');
          console.log('Fresh error code:', freshError.response?.data?.code);
          console.log('Fresh error message:', freshError.response?.data?.message);
        }
      }
    }
    
  } catch (submitError) {
    console.log('❌ Task submission failed');
    console.log('Submit error:', submitError.response?.data);
  }
}

testAuthenticationDetails();