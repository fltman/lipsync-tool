const { KlingAIService } = require('./dist/services/klingai');
const dotenv = require('dotenv');

dotenv.config();

async function testKlingAI() {
  const service = new KlingAIService();
  
  console.log('Testing KlingAI JWT token generation...');
  
  try {
    // Test token generation by calling a simple method
    const mockTaskId = '12345';
    console.log('Testing status check...');
    
    const status = await service.checkTaskStatus(mockTaskId);
    console.log('Status response:', status);
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Full error:', error);
  }
}

testKlingAI();