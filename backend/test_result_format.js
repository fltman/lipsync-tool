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
  
  return jwt.sign(payload, secretKey, { 
    header: { alg: "HS256", typ: "JWT" } 
  });
}

async function checkResultFormat() {
  console.log('=== Checking Task Result Format ===\n');
  
  const jwtToken = generateJWTToken();
  
  const client = axios.create({
    baseURL: 'https://api.klingai.com',
    timeout: 30000,
    headers: {
      'User-Agent': 'Lipsync-Tool/1.0.0'
    }
  });

  try {
    const response = await client.get('/v1/videos/lip-sync', {
      headers: {
        'Authorization': `Bearer ${jwtToken}`
      }
    });
    
    console.log('✅ Got task list!');
    
    // Find completed tasks and examine their result format
    const completedTasks = response.data.data.filter(task => task.task_status === 'succeed');
    
    console.log(`Found ${completedTasks.length} completed tasks`);
    
    completedTasks.forEach((task, index) => {
      console.log(`\n--- Completed Task ${index + 1} ---`);
      console.log('Task ID:', task.task_id);
      console.log('Status:', task.task_status);
      console.log('Created:', new Date(task.created_at).toISOString());
      console.log('Updated:', new Date(task.updated_at).toISOString());
      console.log('Result type:', typeof task.task_result);
      console.log('Result structure:');
      console.log(JSON.stringify(task.task_result, null, 2));
      
      // Try to extract video URL
      if (task.task_result) {
        if (Array.isArray(task.task_result)) {
          console.log('Result is array, first item:', task.task_result[0]);
        } else if (task.task_result.videos) {
          console.log('Found videos array:', task.task_result.videos);
        } else if (task.task_result.video_url || task.task_result.url) {
          console.log('Found direct URL:', task.task_result.video_url || task.task_result.url);
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }
}

checkResultFormat();