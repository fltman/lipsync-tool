const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

// Set FFmpeg paths if available
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}
if (process.env.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
}

function analyzeVideo(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      
      if (!videoStream) {
        reject(new Error('No video stream found'));
        return;
      }

      resolve({
        filename: path.basename(videoPath),
        format: metadata.format,
        video: {
          codec_name: videoStream.codec_name,
          codec_long_name: videoStream.codec_long_name,
          profile: videoStream.profile,
          width: videoStream.width,
          height: videoStream.height,
          coded_width: videoStream.coded_width,
          coded_height: videoStream.coded_height,
          has_b_frames: videoStream.has_b_frames,
          pix_fmt: videoStream.pix_fmt,
          level: videoStream.level,
          color_range: videoStream.color_range,
          color_space: videoStream.color_space,
          color_transfer: videoStream.color_transfer,
          color_primaries: videoStream.color_primaries,
          r_frame_rate: videoStream.r_frame_rate,
          avg_frame_rate: videoStream.avg_frame_rate,
          time_base: videoStream.time_base,
          bit_rate: videoStream.bit_rate,
          tags: videoStream.tags
        },
        audio: audioStream ? {
          codec_name: audioStream.codec_name,
          codec_long_name: audioStream.codec_long_name,
          profile: audioStream.profile,
          sample_fmt: audioStream.sample_fmt,
          sample_rate: audioStream.sample_rate,
          channels: audioStream.channels,
          channel_layout: audioStream.channel_layout,
          bit_rate: audioStream.bit_rate,
          bits_per_sample: audioStream.bits_per_sample
        } : null
      });
    });
  });
}

async function compareVideos() {
  console.log('=== Analyzing Video Format Differences ===\n');
  
  const tempDir = './temp';
  
  // Find original segment and processed segment
  const originalSegment = path.join(tempDir, 'segment_050a195a-cab1-460e-aab8-b14f385413ff.mp4');
  const processedSegment = path.join(tempDir, 'final_test_download.mp4'); // From our previous test
  
  // Also check if we have uploaded original video
  const uploadFiles = fs.readdirSync(tempDir)
    .filter(f => f.startsWith('upload_') && f.endsWith('.mp4'))
    .sort()
    .slice(-1); // Get the latest upload
  
  const originalVideo = uploadFiles.length > 0 ? path.join(tempDir, uploadFiles[0]) : null;
  
  const videos = [
    { name: 'Original Video', path: originalVideo },
    { name: 'Original Segment', path: originalSegment },
    { name: 'KlingAI Processed', path: processedSegment }
  ].filter(v => v.path && fs.existsSync(v.path));
  
  if (videos.length === 0) {
    console.log('❌ No video files found for analysis');
    return;
  }
  
  console.log(`Found ${videos.length} videos to analyze:\n`);
  
  const analyses = [];
  
  for (const video of videos) {
    try {
      console.log(`Analyzing ${video.name}...`);
      const analysis = await analyzeVideo(video.path);
      analyses.push({ ...video, analysis });
      console.log('✅ Complete\n');
    } catch (error) {
      console.log(`❌ Failed: ${error.message}\n`);
    }
  }
  
  // Compare video properties
  console.log('=== COMPARISON RESULTS ===\n');
  
  const properties = [
    'format.format_name',
    'format.bit_rate', 
    'video.codec_name',
    'video.profile',
    'video.width',
    'video.height', 
    'video.pix_fmt',
    'video.r_frame_rate',
    'video.bit_rate',
    'video.color_range',
    'video.color_space',
    'video.color_transfer',
    'video.color_primaries',
    'audio.codec_name',
    'audio.sample_rate',
    'audio.channels',
    'audio.bit_rate'
  ];
  
  function getNestedValue(obj, path) {
    return path.split('.').reduce((curr, prop) => curr && curr[prop], obj);
  }
  
  properties.forEach(prop => {
    const values = analyses.map(a => ({
      name: a.name,
      value: getNestedValue(a.analysis, prop)
    }));
    
    const uniqueValues = [...new Set(values.map(v => v.value))];
    
    if (uniqueValues.length > 1) {
      console.log(`🚨 DIFFERENCE in ${prop}:`);
      values.forEach(v => {
        console.log(`   ${v.name}: ${v.value || 'undefined'}`);
      });
      console.log('');
    }
  });
  
  // Output detailed analysis
  console.log('=== DETAILED ANALYSIS ===\n');
  analyses.forEach(a => {
    console.log(`--- ${a.name} (${a.analysis.filename}) ---`);
    console.log(`Format: ${a.analysis.format.format_name}`);
    console.log(`Container bitrate: ${a.analysis.format.bit_rate || 'N/A'}`);
    console.log(`Duration: ${a.analysis.format.duration}s`);
    console.log(`Size: ${(a.analysis.format.size / 1024 / 1024).toFixed(2)}MB`);
    console.log('');
    console.log('Video:');
    console.log(`  Codec: ${a.analysis.video.codec_name} (${a.analysis.video.profile || 'no profile'})`);
    console.log(`  Resolution: ${a.analysis.video.width}x${a.analysis.video.height}`);
    console.log(`  Pixel format: ${a.analysis.video.pix_fmt}`);
    console.log(`  Frame rate: ${a.analysis.video.r_frame_rate}`);
    console.log(`  Bitrate: ${a.analysis.video.bit_rate || 'N/A'}`);
    console.log(`  Color space: ${a.analysis.video.color_space || 'N/A'}`);
    console.log(`  Color range: ${a.analysis.video.color_range || 'N/A'}`);
    console.log('');
    if (a.analysis.audio) {
      console.log('Audio:');
      console.log(`  Codec: ${a.analysis.audio.codec_name}`);
      console.log(`  Sample rate: ${a.analysis.audio.sample_rate}Hz`);
      console.log(`  Channels: ${a.analysis.audio.channels}`);
      console.log(`  Bitrate: ${a.analysis.audio.bit_rate || 'N/A'}`);
      console.log('');
    }
    console.log('----------------------------------------\n');
  });
}

compareVideos().catch(console.error);