import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { VideoMetadata } from '../types';
import { logger } from '../index';

if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}

if (process.env.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
}

export class FFmpegService {
  async getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          logger.error('Error getting video metadata:', err);
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        const duration = metadata.format.duration || 0;
        const width = videoStream.width || 0;
        const height = videoStream.height || 0;
        const framerate = eval(videoStream.r_frame_rate || '0');
        const codec = videoStream.codec_name || 'unknown';
        const format = metadata.format.format_name || 'unknown';
        const size = metadata.format.size || 0;

        resolve({
          duration,
          resolution: { width, height },
          framerate,
          codec,
          format,
          size
        });
      });
    });
  }

  async extractSegment(
    inputPath: string,
    outputPath: string,
    startTime: number,
    duration: number,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use accurate seeking by placing -ss after input
      // This is slower but ensures frame-accurate extraction
      const command = ffmpeg(inputPath)
        .seekInput(startTime)
        .duration(duration)
        .output(outputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset', 'ultrafast',  // Use fastest encoding preset
          '-crf', '18',  // High quality
          '-avoid_negative_ts', 'make_zero'
        ]);

      if (onProgress) {
        command.on('progress', (progress) => {
          const percent = Math.min(100, Math.max(0, progress.percent || 0));
          onProgress(percent);
        });
      }

      command
        .on('start', (cmd) => {
          logger.info(`FFmpeg command: ${cmd}`);
        })
        .on('end', () => {
          logger.info(`Segment extracted successfully: ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          logger.error(`Error extracting segment: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  async extractAudio(
    inputPath: string,
    outputPath: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .output(outputPath)
        .noVideo()
        .audioCodec('pcm_s16le')
        .audioFrequency(44100)
        .audioChannels(2)
        .outputFormat('wav');

      if (onProgress) {
        command.on('progress', (progress) => {
          const percent = Math.min(100, Math.max(0, progress.percent || 0));
          onProgress(percent);
        });
      }

      command
        .on('start', (cmd) => {
          logger.info(`FFmpeg audio extraction command: ${cmd}`);
        })
        .on('end', () => {
          logger.info(`Audio extracted successfully: ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          logger.error(`Error extracting audio: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  async concatenateVideos(
    segments: { path: string; isProcessed: boolean }[],
    outputPath: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    // Check if segments have mixed properties (processed vs original)
    const hasProcessedSegments = segments.some(s => s.isProcessed);
    const hasOriginalSegments = segments.some(s => !s.isProcessed);
    
    if (hasProcessedSegments && hasOriginalSegments) {
      // Mixed segments - normalize all to consistent format
      await this.concatenateWithNormalization(segments, outputPath, onProgress);
    } else {
      // All segments are same type - use faster copy method
      await this.concatenateWithCopy(segments, outputPath, onProgress);
    }
  }

  private async concatenateWithCopy(
    segments: { path: string; isProcessed: boolean }[],
    outputPath: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const listPath = path.join(path.dirname(outputPath), 'concat_list.txt');
    
    const listContent = segments
      .map(seg => `file '${path.resolve(seg.path)}'`)
      .join('\n');
    
    await fs.writeFile(listPath, listContent);

    return new Promise(async (resolve, reject) => {
      const command = ffmpeg()
        .input(listPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .output(outputPath)
        .videoCodec('copy')
        .audioCodec('copy');

      if (onProgress) {
        command.on('progress', (progress) => {
          const percent = Math.min(100, Math.max(0, progress.percent || 0));
          onProgress(percent);
        });
      }

      command
        .on('start', (cmd) => {
          logger.info(`FFmpeg concatenate (copy) command: ${cmd}`);
        })
        .on('end', async () => {
          await fs.unlink(listPath).catch(() => {});
          logger.info(`Videos concatenated successfully: ${outputPath}`);
          resolve();
        })
        .on('error', async (err) => {
          await fs.unlink(listPath).catch(() => {});
          logger.error(`Error concatenating videos: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  private async concatenateWithNormalization(
    segments: { path: string; isProcessed: boolean }[],
    outputPath: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    logger.info('Concatenating with normalization due to mixed segment types');
    
    const tempDir = path.dirname(outputPath);
    const normalizedSegments: string[] = [];
    
    try {
      // Normalize each segment to consistent format
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const normalizedPath = path.join(tempDir, `normalized_${i}.mp4`);
        
        await this.normalizeSegment(segment.path, normalizedPath);
        normalizedSegments.push(normalizedPath);
        
        // Update progress for normalization phase (first 70%)
        if (onProgress) {
          const normalizationProgress = ((i + 1) / segments.length) * 70;
          onProgress(normalizationProgress);
        }
      }
      
      // Create concat list with normalized segments
      const listPath = path.join(tempDir, 'concat_normalized_list.txt');
      const listContent = normalizedSegments
        .map(seg => `file '${path.resolve(seg)}'`)
        .join('\n');
      
      await fs.writeFile(listPath, listContent);

      // Concatenate normalized segments
      return new Promise(async (resolve, reject) => {
        const command = ffmpeg()
          .input(listPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .output(outputPath)
          .videoCodec('copy')
          .audioCodec('copy');

        command.on('progress', (progress) => {
          if (onProgress) {
            // Concat phase is remaining 30%
            const totalProgress = 70 + ((progress.percent || 0) * 0.3);
            onProgress(Math.min(100, totalProgress));
          }
        });

        command
          .on('start', (cmd) => {
            logger.info(`FFmpeg concatenate (normalized) command: ${cmd}`);
          })
          .on('end', async () => {
            // Cleanup
            await fs.unlink(listPath).catch(() => {});
            for (const normalizedPath of normalizedSegments) {
              await fs.unlink(normalizedPath).catch(() => {});
            }
            logger.info(`Normalized videos concatenated successfully: ${outputPath}`);
            resolve();
          })
          .on('error', async (err) => {
            // Cleanup on error
            await fs.unlink(listPath).catch(() => {});
            for (const normalizedPath of normalizedSegments) {
              await fs.unlink(normalizedPath).catch(() => {});
            }
            logger.error(`Error concatenating normalized videos: ${err.message}`);
            reject(err);
          })
          .run();
      });
      
    } catch (error) {
      // Cleanup normalized segments on error
      for (const normalizedPath of normalizedSegments) {
        await fs.unlink(normalizedPath).catch(() => {});
      }
      throw error;
    }
  }

  private async normalizeSegment(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .output(outputPath)
        // Normalize video settings
        .videoCodec('libx264')
        .videoBitrate('3000k')  // Consistent bitrate
        .fps(24)                // Consistent frame rate (24fps)
        .size('1280x720')      // Consistent resolution
        .aspect('16:9')
        .outputOptions([
          '-preset', 'medium',
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          '-colorspace', 'bt709',
          '-color_primaries', 'bt709',
          '-color_trc', 'bt709',
          '-movflags', '+faststart'
        ])
        // Normalize audio settings
        .audioCodec('aac')
        .audioBitrate('128k')
        .audioFrequency(48000)   // Consistent sample rate
        .audioChannels(2)
        .outputOptions(['-profile:a', 'aac_low'])
        .on('start', (cmd) => {
          logger.info(`Normalizing segment: ${path.basename(inputPath)}`);
        })
        .on('end', () => {
          logger.info(`Segment normalized: ${path.basename(outputPath)}`);
          resolve();
        })
        .on('error', (err) => {
          logger.error(`Error normalizing segment: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  async generateThumbnail(
    videoPath: string,
    outputPath: string,
    timestamp: number = 0
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamp],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '320x180'
        })
        .on('end', () => {
          logger.info(`Thumbnail generated: ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          logger.error(`Error generating thumbnail: ${err.message}`);
          reject(err);
        });
    });
  }

  async splitVideoAtSegments(
    inputPath: string,
    segments: { start: number; end: number; replacement?: string }[],
    outputPath: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const tempDir = path.dirname(outputPath);
    const parts: { path: string; isProcessed: boolean }[] = [];
    
    segments.sort((a, b) => a.start - b.start);
    
    let currentTime = 0;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      // Add original video parts between segments
      if (currentTime < segment.start) {
        const partPath = path.join(tempDir, `part_${i}_original.mp4`);
        await this.extractSegment(
          inputPath, 
          partPath, 
          currentTime, 
          segment.start - currentTime
        );
        parts.push({ path: partPath, isProcessed: false });
      }
      
      // Add segment (either processed replacement or original segment)
      if (segment.replacement) {
        // This is a processed segment from KlingAI - get its actual duration
        const processedMetadata = await this.getVideoMetadata(segment.replacement);
        const actualDuration = processedMetadata.duration;
        const originalDuration = segment.end - segment.start;
        
        logger.info(`Processed segment duration adjustment: original ${originalDuration.toFixed(2)}s → processed ${actualDuration.toFixed(2)}s (${(actualDuration - originalDuration).toFixed(2)}s difference)`);
        
        parts.push({ path: segment.replacement, isProcessed: true });
        
        // Update currentTime based on actual processed duration, keeping same start point
        currentTime = segment.start + actualDuration;
      } else {
        // This is an original segment (rejected or unprocessed)
        const partPath = path.join(tempDir, `part_${i}_segment.mp4`);
        await this.extractSegment(
          inputPath, 
          partPath, 
          segment.start, 
          segment.end - segment.start
        );
        parts.push({ path: partPath, isProcessed: false });
        currentTime = segment.end;
      }
    }
    
    // Add final part if there's remaining video
    const metadata = await this.getVideoMetadata(inputPath);
    if (currentTime < metadata.duration) {
      const partPath = path.join(tempDir, `part_final.mp4`);
      await this.extractSegment(
        inputPath, 
        partPath, 
        currentTime, 
        metadata.duration - currentTime
      );
      parts.push({ path: partPath, isProcessed: false });
    }
    
    logger.info(`Export segments: ${parts.length} parts (${parts.filter(p => p.isProcessed).length} processed, ${parts.filter(p => !p.isProcessed).length} original)`);
    
    await this.concatenateVideos(parts, outputPath, onProgress);
    
    // Cleanup temporary parts (but keep processed segments from KlingAI)
    for (const part of parts) {
      // Only delete parts that were created temporarily, not processed segments from KlingAI
      if (!part.isProcessed && !segments.some(s => s.replacement === part.path)) {
        await fs.unlink(part.path).catch(() => {});
      }
    }
  }
}