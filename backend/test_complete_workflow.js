const { KlingAIService } = require('./dist/services/klingai');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

async function testCompleteWorkflow() {
  console.log('=== Testing Complete KlingAI Workflow ===\n');
  
  const service = new KlingAIService();
  
  // Use existing segment files
  const tempDir = './temp';
  const segmentVideoPath = path.join(tempDir, 'segment_050a195a-cab1-460e-aab8-b14f385413ff.mp4');
  const segmentAudioPath = path.join(tempDir, 'segment_050a195a-cab1-460e-aab8-b14f385413ff.wav');
  const processedVideoPath = path.join(tempDir, 'test_processed_complete.mp4');
  
  console.log('Input files:');
  console.log('- Video:', segmentVideoPath);
  console.log('- Audio:', segmentAudioPath);
  console.log('- Output:', processedVideoPath);
  
  try {
    console.log('\n1. Submitting lipsync task...');
    const taskId = await service.submitLipsyncTask(segmentVideoPath, segmentAudioPath);
    console.log('✅ Task submitted:', taskId);
    
    console.log('\n2. Checking initial status...');
    const initialStatus = await service.checkTaskStatus(taskId);
    console.log('✅ Initial status:', initialStatus.task_status);
    console.log('   Created:', new Date(initialStatus.created_at).toLocaleString());
    
    console.log('\n3. Testing pollTaskUntilComplete...');
    console.log('   (This will wait for the task to complete - may take 3-5 minutes)');
    
    let progressCount = 0;
    const resultUrl = await service.pollTaskUntilComplete(
      taskId,
      (progress, status) => {
        progressCount++;
        if (progressCount % 5 === 0) { // Log every 5th update to avoid spam
          console.log(`   Progress: ${progress}% - Status: ${status}`);
        }
      },
      600000 // 10 minutes timeout
    );
    
    console.log('✅ Task completed!');
    console.log('   Result URL:', resultUrl);
    
    console.log('\n4. Testing download...');
    await service.downloadResult(resultUrl, processedVideoPath);
    console.log('✅ Download completed!');
    console.log('   File saved to:', processedVideoPath);
    
    // Verify file exists and has content
    const fs = require('fs');
    const stats = fs.statSync(processedVideoPath);
    console.log('   File size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
    
    console.log('\n🎉 COMPLETE WORKFLOW SUCCESS!');
    console.log('   - Task submission: ✅');
    console.log('   - Status checking: ✅');
    console.log('   - Progress polling: ✅');
    console.log('   - Video download: ✅');
    
  } catch (error) {
    console.error('❌ Workflow failed:', error.message);
    console.error('Full error:', error);
  }
}

// Only run if we have the required files
const fs = require('fs');
const segmentVideo = './temp/segment_050a195a-cab1-460e-aab8-b14f385413ff.mp4';

if (fs.existsSync(segmentVideo)) {
  testCompleteWorkflow();
} else {
  console.log('❌ Test segment file not found:', segmentVideo);
  console.log('Please ensure you have uploaded a video and created segments first.');
}