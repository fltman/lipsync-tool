const { FFmpegService } = require('./dist/services/ffmpeg');
const path = require('path');
const fs = require('fs');

async function checkDurationDifferences() {
  console.log('=== Checking Duration Differences ===\n');
  
  const ffmpegService = new FFmpegService();
  const tempDir = './temp';
  
  // Find recent segments
  const files = fs.readdirSync(tempDir);
  const originalSegments = files.filter(f => f.startsWith('segment_') && f.endsWith('.mp4'));
  const processedSegments = files.filter(f => f.startsWith('processed_') && f.endsWith('.mp4'));
  
  console.log(`Found ${originalSegments.length} original segments and ${processedSegments.length} processed segments`);
  
  for (const originalFile of originalSegments) {
    const segmentId = originalFile.replace('segment_', '').replace('.mp4', '');
    const processedFile = `processed_${segmentId}.mp4`;
    
    if (processedSegments.includes(processedFile)) {
      const originalPath = path.join(tempDir, originalFile);
      const processedPath = path.join(tempDir, processedFile);
      
      try {
        const originalMeta = await ffmpegService.getVideoMetadata(originalPath);
        const processedMeta = await ffmpegService.getVideoMetadata(processedPath);
        
        const durationDiff = processedMeta.duration - originalMeta.duration;
        
        console.log(`\n--- Segment ${segmentId.substring(0, 8)}... ---`);
        console.log(`Original:  ${originalMeta.duration.toFixed(3)}s`);
        console.log(`Processed: ${processedMeta.duration.toFixed(3)}s`);
        console.log(`Difference: ${durationDiff >= 0 ? '+' : ''}${durationDiff.toFixed(3)}s`);
        
        if (Math.abs(durationDiff) > 0.01) { // More than 10ms difference
          console.log(`⚠️  Duration change detected: ${Math.abs(durationDiff).toFixed(3)}s ${durationDiff > 0 ? 'longer' : 'shorter'}`);
        } else {
          console.log(`✅ Duration match (within 10ms tolerance)`);
        }
      } catch (error) {
        console.log(`❌ Error checking ${segmentId}: ${error.message}`);
      }
    }
  }
  
  console.log('\n=== Duration Summary ===');
  console.log('This shows whether KlingAI processed videos have different durations.');
  console.log('Our export logic now adjusts for these differences automatically.');
}

checkDurationDifferences().catch(console.error);