import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { logger } from '../index';
import { cloudStorage } from './cloudStorage';

export interface KlingAIResponse {
  success: boolean;
  data?: {
    task_id: string;
    task_status: 'submitted' | 'processing' | 'succeed' | 'failed';
    task_status_msg?: string;
    task_result?: {
      videos?: Array<{
        url: string;
        duration: number;
      }>;
    };
    result_url?: string;
    progress?: number;
    error?: string;
  };
  error?: string;
}

export class KlingAIService {
  private client: AxiosInstance;
  private accessKey: string;
  private secretKey: string;

  constructor() {
    this.accessKey = process.env.KLINGAI_ACCESS_KEY || '';
    this.secretKey = process.env.KLINGAI_SECRET_KEY || '';
    
    if (!this.accessKey || !this.secretKey) {
      console.warn('KlingAI API credentials not configured - using development mock mode');
    }

    this.client = axios.create({
      baseURL: process.env.KLINGAI_API_ENDPOINT || 'https://api-singapore.klingai.com',
      timeout: 30000,
      headers: {
        'User-Agent': 'Lipsync-Tool/1.0.0'
      }
    });

    this.client.interceptors.request.use((config) => {
      logger.info(`KlingAI API Request: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });

    this.client.interceptors.response.use(
      (response) => {
        logger.info(`KlingAI API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error(`KlingAI API Error: ${error.response?.status} ${error.message}`);
        return Promise.reject(error);
      }
    );
  }

  private generateJWTToken(): string {
    const jwt = require('jsonwebtoken');
    const currentTime = Math.floor(Date.now() / 1000);
    
    const payload = {
      iss: this.accessKey,
      exp: currentTime + 1800, // Valid for 30 minutes
      nbf: currentTime - 5, // Effective from 5 seconds ago
      iat: currentTime // Issued at time
    };
    
    const token = jwt.sign(payload, this.secretKey, { 
      algorithm: 'HS256',
      noTimestamp: true // Don't add automatic iat
    });
    
    logger.info('JWT Token generated:');
    return token;
  }

  async submitLipsyncTask(
    videoPath: string,
    audioPath: string,
    options?: { quality?: string; speed?: number }
  ): Promise<{ taskId: string; cloudKeys?: string[] }> {
    // Development mode: simulate API without actual calls (only if no credentials)
    if (process.env.NODE_ENV === 'development' && process.env.DISABLE_KLINGAI_API === 'true') {
      logger.info('Development mode: simulating KlingAI task submission');
      const mockTaskId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return { taskId: mockTaskId };
    }

    try {
      const jwtToken = this.generateJWTToken();
      
      let videoUrl: string;
      let audioUrl: string;
      let cloudKeys: string[] = [];
      
      // Check if cloud storage is available
      if (cloudStorage.isAvailable()) {
        logger.info('Using cloud storage for file hosting');
        const uploadResult = await cloudStorage.uploadForProcessing(videoPath, audioPath);
        videoUrl = uploadResult.videoUrl;
        audioUrl = uploadResult.audioUrl;
        cloudKeys = uploadResult.keys;
        logger.info(`Files uploaded to cloud: video=${videoUrl}, audio=${audioUrl}`);
      } else {
        // Fallback to ngrok/local serving if cloud storage not configured
        logger.warn('Cloud storage not configured, falling back to local serving');
        const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3001';
        const videoFileName = path.basename(videoPath);
        const audioFileName = path.basename(audioPath);
        videoUrl = `${baseUrl}/api/files/${videoFileName}`;
        audioUrl = `${baseUrl}/api/files/${audioFileName}`;
      }
      
      logger.info(`Submitting lipsync task with video: ${videoUrl}, audio: ${audioUrl}`);
      
      // Check file sizes
      const videoStats = fs.statSync(videoPath);
      const audioStats = fs.statSync(audioPath);
      logger.info(`Video file size: ${videoStats.size} bytes, Audio file size: ${audioStats.size} bytes`);
      
      let response;
      
      // Try URL-based approach first (preferred when using cloud storage)
      if (cloudStorage.isAvailable()) {
        const requestData = {
          input: {
            mode: "audio2video",
            video_url: videoUrl,
            audio_type: "url",
            audio_url: audioUrl
          }
        };
        
        if (options?.quality) {
          (requestData.input as any).quality = options.quality;
        }
        if (options?.speed) {
          (requestData.input as any).speed = options.speed;
        }
        
        logger.info('URL Request payload:', JSON.stringify(requestData, null, 2));
        
        try {
          response = await this.client.post('/v1/videos/lip-sync', requestData, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${jwtToken}`
            }
          });
        } catch (urlError: any) {
          logger.error('URL-based submission failed:', urlError.message);
          throw urlError;
        }
      } else {
        // Direct file upload approach (fallback for local development)
        const formData = new FormData();
        formData.append('video', fs.createReadStream(videoPath), {
          filename: path.basename(videoPath),
          contentType: 'video/mp4'
        });
        formData.append('audio', fs.createReadStream(audioPath), {
          filename: path.basename(audioPath),
          contentType: 'audio/wav'
        });
        
        formData.append('mode', 'audio2video');
        
        if (options?.quality) {
          formData.append('quality', options.quality);
        }
        if (options?.speed) {
          formData.append('speed', options.speed.toString());
        }
        
        logger.info('Using direct file upload approach');
        
        response = await this.client.post('/v1/videos/lip-sync', formData, {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${jwtToken}`
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        });
      }

      logger.info('API Response received:', JSON.stringify(response?.data, null, 2));
      
      // Handle KlingAI API response format: { code: 0, data: { task_id: "...", ... }, message: "SUCCEED" }
      let taskId: string;
      
      if (response && response.data && response.data.code === 0 && response.data.data?.task_id) {
        taskId = response.data.data.task_id;
      } else if (response && response.data && response.data.task_id) {
        taskId = response.data.task_id;
      } else if (response && response.data.success && response.data.data?.task_id) {
        taskId = response.data.data.task_id;
      } else {
        logger.error('Unexpected response format:', {
          hasResponse: !!response,
          hasData: !!response?.data,
          dataKeys: response?.data ? Object.keys(response.data) : 'none',
          fullResponse: response?.data
        });
        // Clean up cloud files if upload failed
        if (cloudKeys.length > 0) {
          await cloudStorage.deleteFiles(cloudKeys);
        }
        throw new Error(response?.data?.error || 'Failed to submit lipsync task');
      }
      
      logger.info(`Lipsync task submitted: ${taskId}`);
      return { taskId, cloudKeys };
    } catch (error: any) {
      logger.error('Error submitting lipsync task:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
          data: error.config?.data
        }
      });
      
      if (error.response?.data) {
        logger.error('Full API Response:', JSON.stringify(error.response.data, null, 2));
      }
      
      if (error.request && !error.response) {
        logger.error('No response received. Request details:', {
          url: error.config?.url,
          method: error.config?.method,
          timeout: error.config?.timeout
        });
      }
      
      // Check if this is a credential issue
      if (!this.accessKey || !this.secretKey) {
        throw new Error('KlingAI API credentials not configured');
      }
      
      throw new Error(`KlingAI API error: ${error.message}`);
    }
  }

  async checkTaskStatus(taskId: string): Promise<KlingAIResponse['data']> {
    // Development mode: simulate task status
    if (process.env.NODE_ENV === 'development' && process.env.DISABLE_KLINGAI_API === 'true') {
      logger.info(`Development mode: simulating task status for ${taskId}`);
      return {
        task_id: taskId,
        task_status: 'succeed',
        task_result: {
          videos: [{
            url: `mock://processed_${taskId}.mp4`,
            duration: 30
          }]
        },
        progress: 100
      };
    }

    try {
      const jwtToken = this.generateJWTToken();

      const response = await this.client.get('/v1/videos/lip-sync', {
        params: { task_id: taskId },
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      });

      // Response returns array of tasks, find our specific task
      if (response.data.code === 0 && Array.isArray(response.data.data)) {
        const taskData = response.data.data.find((task: any) => task.task_id === taskId);
        if (taskData) {
          return taskData;
        } else {
          throw new Error('Task not found in response');
        }
      } else {
        throw new Error(response.data.message || 'Failed to get task status');
      }
    } catch (error: any) {
      logger.error(`Error checking task status for ${taskId}:`, error.message);
      throw new Error(`Failed to check task status: ${error.message}`);
    }
  }

  async downloadResult(resultUrl: string, outputPath: string): Promise<void> {
    // Development mode: simulate download by copying original video
    if (process.env.NODE_ENV === 'development' && process.env.DISABLE_KLINGAI_API === 'true') {
      logger.info(`Development mode: simulating download to ${outputPath}`);
      const fs = require('fs');
      
      // Find the original video file to copy as mock processed result
      const tempDir = path.dirname(outputPath);
      const files = fs.readdirSync(tempDir);
      const originalVideo = files.find((f: string) => f.startsWith('segment_') && f.endsWith('.mp4'));
      
      if (originalVideo) {
        const originalPath = path.join(tempDir, originalVideo);
        fs.copyFileSync(originalPath, outputPath);
        logger.info(`Mock download completed: copied ${originalPath} to ${outputPath}`);
      } else {
        throw new Error('No original video file found for mock processing');
      }
      return;
    }

    try {
      const response = await axios({
        method: 'GET',
        url: resultUrl,
        responseType: 'stream',
        timeout: 120000,
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });

      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          logger.info(`Downloaded lipsync result: ${outputPath}`);
          resolve();
        });
        writer.on('error', (err) => {
          logger.error(`Error downloading result: ${err.message}`);
          reject(err);
        });
      });
    } catch (error: any) {
      logger.error('Error downloading result:', error.message);
      throw new Error(`Failed to download result: ${error.message}`);
    }
  }

  async pollTaskUntilComplete(
    taskId: string,
    onProgress?: (progress: number, status: string) => void,
    maxWaitTime: number = 1200000, // 20 minutes for longer clips
    cloudKeys?: string[] // Cloud storage keys to clean up
  ): Promise<string> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const status = await this.checkTaskStatus(taskId);
        
        if (!status) {
          throw new Error('No status data returned');
        }
        
        if (onProgress) {
          // Estimate progress based on status
          let progress = 0;
          switch (status.task_status) {
            case 'submitted': progress = 10; break;
            case 'processing': progress = 50; break;
            case 'succeed': progress = 100; break;
            case 'failed': progress = 0; break;
            default: progress = 0;
          }
          onProgress(progress, status.task_status || 'processing');
        }

        switch (status.task_status) {
          case 'succeed':
            if (status.task_result?.videos?.[0]?.url) {
              logger.info(`Task ${taskId} completed with result: ${status.task_result.videos[0].url}`);
              return status.task_result.videos[0].url;
            } else {
              throw new Error('Task completed but no result URL provided');
            }
          
          case 'failed':
            throw new Error(status.task_status_msg || 'Task failed with unknown error');
          
          case 'processing':
            // Log progress for longer clips
            logger.info(`Task ${taskId} still processing... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);
            await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10 seconds for processing
            break;
          
          case 'submitted':
            logger.info(`Task ${taskId} submitted, waiting for processing to start...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            break;
          
          default:
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error: any) {
        logger.error(`Error polling task ${taskId}:`, error.message);
        throw error;
      }
    }
    
    throw new Error(`Task ${taskId} timed out after ${maxWaitTime}ms`);
  }

  async processSegment(
    videoPath: string,
    audioPath: string,
    outputPath: string,
    onProgress?: (progress: number, status: string) => void,
    estimatedDuration?: number // Duration in seconds to estimate timeout
  ): Promise<void> {
    let cloudKeys: string[] = [];
    
    try {
      logger.info(`Starting lipsync processing for video: ${videoPath}, audio: ${audioPath}`);
      
      const submitResult = await this.submitLipsyncTask(videoPath, audioPath);
      const taskId = submitResult.taskId;
      cloudKeys = submitResult.cloudKeys || [];
      
      onProgress?.(10, 'Task submitted, waiting for processing...');
      
      // Calculate timeout based on video duration
      const baseTimeout = 1200000; // 20 minutes base
      const timeoutMultiplier = parseInt(process.env.KLINGAI_TIMEOUT_MULTIPLIER || '180') * 1000; // Default 3 minutes per second
      const durationBasedTimeout = estimatedDuration ? Math.max(baseTimeout, estimatedDuration * timeoutMultiplier) : baseTimeout;
      
      logger.info(`Using timeout of ${Math.round(durationBasedTimeout / 1000)}s for estimated ${estimatedDuration || 'unknown'}s video duration`);
      
      const resultUrl = await this.pollTaskUntilComplete(
        taskId,
        (progress, status) => {
          onProgress?.(10 + (progress * 0.8), status);
        },
        durationBasedTimeout,
        cloudKeys
      );
      
      onProgress?.(90, 'Downloading result...');
      
      await this.downloadResult(resultUrl, outputPath);
      
      // Clean up cloud storage files after successful download
      if (cloudKeys.length > 0) {
        await cloudStorage.deleteFiles(cloudKeys);
      }
      
      onProgress?.(100, 'Complete');
      
      logger.info(`Lipsync processing completed: ${outputPath}`);
    } catch (error: any) {
      logger.error('Error processing segment:', error.message);
      
      // Clean up cloud storage files on error
      if (cloudKeys.length > 0) {
        await cloudStorage.deleteFiles(cloudKeys);
      }
      
      throw error;
    }
  }
}