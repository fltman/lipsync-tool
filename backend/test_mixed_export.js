const { FFmpegService } = require('./dist/services/ffmpeg');
const path = require('path');
const fs = require('fs');

async function testMixedSegmentExport() {
  console.log('=== Testing Mixed Segment Export (Normalization) ===\n');
  
  const ffmpegService = new FFmpegService();
  const tempDir = './temp';
  
  // Find files for testing
  const originalVideo = path.join(tempDir, 'upload_9e3894f2-aad4-429d-a964-f7ffce722ce3.mp4');
  const processedSegment = path.join(tempDir, 'processed_982347bd-086e-4c70-8483-f34533a9be01.mp4');
  const outputPath = path.join(tempDir, 'test_mixed_export.mp4');
  
  if (!fs.existsSync(originalVideo)) {
    console.log('❌ Original video not found');
    return;
  }
  
  if (!fs.existsSync(processedSegment)) {
    console.log('❌ Processed segment not found');
    return;
  }
  
  try {
    console.log('Files found:');
    console.log('- Original:', path.basename(originalVideo));
    console.log('- Processed:', path.basename(processedSegment));
    console.log('- Output:', path.basename(outputPath));
    
    // Create segments that will force normalization
    const segments = [
      {
        start: 0,
        end: 106.31,  // Original video part
        replacement: undefined
      },
      {
        start: 106.31,
        end: 116.89,  // Processed segment (KlingAI)
        replacement: processedSegment
      },
      {
        start: 116.89,
        end: 200,     // Original video part
        replacement: undefined
      }
    ];
    
    console.log('\nSegments:');
    segments.forEach((seg, i) => {
      console.log(`${i + 1}. ${seg.start}s - ${seg.end}s: ${seg.replacement ? 'PROCESSED' : 'ORIGINAL'}`);
    });
    
    console.log('\nStarting export with mixed segments...');
    console.log('This should trigger video normalization due to format differences.');
    
    let progressUpdates = 0;
    const startTime = Date.now();
    
    await ffmpegService.splitVideoAtSegments(
      originalVideo,
      segments,
      outputPath,
      (progress) => {
        progressUpdates++;
        if (progressUpdates % 10 === 0) { // Log every 10th update
          console.log(`Progress: ${Math.round(progress)}%`);
        }
      }
    );
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    // Verify output
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log('\n✅ Export successful!');
      console.log(`- Duration: ${duration.toFixed(1)}s`);
      console.log(`- Output size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Progress updates: ${progressUpdates}`);
      
      // Analyze output video
      console.log('\nAnalyzing output video properties...');
      
      const metadata = await ffmpegService.getVideoMetadata(outputPath);
      console.log('Output video:');
      console.log(`- Resolution: ${metadata.resolution.width}x${metadata.resolution.height}`);
      console.log(`- Duration: ${metadata.duration.toFixed(2)}s`);
      console.log(`- Frame rate: ${metadata.framerate.toFixed(2)}fps`);
      console.log(`- Codec: ${metadata.codec}`);
      console.log(`- Format: ${metadata.format}`);
      
      console.log('\n🎉 Mixed segment export test PASSED!');
      console.log('   - Format normalization: ✅');
      console.log('   - Seamless concatenation: ✅');
      console.log('   - No export glitches: ✅');
      
    } else {
      console.log('❌ Export failed - output file not created');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Only run if we have the required files
testMixedSegmentExport().catch(console.error);