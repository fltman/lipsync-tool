const { KlingAIService } = require('./dist/services/klingai');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

async function testDownloadExisting() {
  console.log('=== Testing Download of Existing Completed Task ===\n');
  
  const service = new KlingAIService();
  
  // Use one of the completed tasks we found earlier
  const completedTaskId = '787833882569359458';
  const expectedUrl = 'https://v15-kling.klingai.com/bs2/upload-ylab-stunt-sgp/se/stream_lake_m2v_video_lip_sync_v2/49462dd6-68d6-49d9-bbd0-9c5c2632ae04_raw_video.mp4?x-kcdn-pid=112372';
  const downloadPath = './temp/test_existing_download.mp4';
  
  try {
    console.log('1. Checking status of completed task...');
    const status = await service.checkTaskStatus(completedTaskId);
    console.log('✅ Status retrieved:');
    console.log('   - Task ID:', status.task_id);
    console.log('   - Status:', status.task_status);
    console.log('   - Created:', new Date(status.created_at).toLocaleString());
    console.log('   - Duration:', status.task_result?.videos?.[0]?.duration, 'seconds');
    
    if (status.task_status === 'succeed' && status.task_result?.videos?.[0]?.url) {
      const resultUrl = status.task_result.videos[0].url;
      console.log('   - Result URL:', resultUrl);
      
      console.log('\n2. Testing download...');
      await service.downloadResult(resultUrl, downloadPath);
      
      // Verify download
      const fs = require('fs');
      const stats = fs.statSync(downloadPath);
      console.log('✅ Download successful!');
      console.log('   - File:', downloadPath);
      console.log('   - Size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
      console.log('   - Modified:', stats.mtime.toLocaleString());
      
      console.log('\n🎉 DOWNLOAD TEST SUCCESS!');
      console.log('   - Status checking: ✅');
      console.log('   - Result URL extraction: ✅');
      console.log('   - Video download: ✅');
      
    } else {
      console.log('❌ Task not completed or no result URL');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDownloadExisting();