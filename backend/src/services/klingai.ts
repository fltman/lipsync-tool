import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { logger } from '../index';

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
      nbf: currentTime - 5 // Effective from 5 seconds ago
    };
    
    const headers = {
      alg: "HS256",
      typ: "JWT"
    };
    
    return jwt.sign(payload, this.secretKey, { header: headers });
  }

  async submitLipsyncTask(
    videoPath: string,
    audioPath: string,
    options?: { quality?: string; speed?: number }
  ): Promise<string> {
    // Development mode: simulate API without actual calls (only if no credentials)
    if (process.env.NODE_ENV === 'development' && process.env.DISABLE_KLINGAI_API === 'true') {
      logger.info('Development mode: simulating KlingAI task submission');
      const mockTaskId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return mockTaskId;
    }

    try {
      const jwtToken = this.generateJWTToken();
      
      // Create public URLs for the files
      const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3001';
      const videoUrl = `${baseUrl}/api/files/${path.basename(videoPath)}`;
      const audioUrl = `${baseUrl}/api/files/${path.basename(audioPath)}`;
      
      logger.info(`Submitting lipsync task with video: ${videoUrl}, audio: ${audioUrl}`);
      
      // Try URL-based approach first  
      let requestData = {
        input: {
          mode: "audio2video", // Audio-to-video generation mode
          video_url: videoUrl,
          audio_type: "url", // Using URL to provide audio
          audio_url: audioUrl,
          ...(options?.quality && { quality: options.quality }),
          ...(options?.speed && { speed: options.speed })
        }
      };

      logger.info('Request payload:');
      logger.info(JSON.stringify(requestData, null, 2));
      logger.info('JWT Token generated:', jwtToken.substring(0, 50) + '...');

      let response;
      try {
        // Use the correct endpoint from documentation
        response = await this.client.post('/v1/videos/lip-sync', requestData, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`,
            'ngrok-skip-browser-warning': 'true'
          }
        });
      } catch (urlError: any) {
        logger.warn('URL-based request failed, trying file upload approach:', urlError.message);
        
        // Fallback to file upload approach
        const formData = new FormData();
        formData.append('video', fs.createReadStream(videoPath));
        formData.append('audio', fs.createReadStream(audioPath));
        
        if (options?.quality) {
          formData.append('quality', options.quality);
        }
        if (options?.speed) {
          formData.append('speed', options.speed.toString());
        }

        // Use the correct endpoint for file upload too
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
      if (response && response.data && response.data.code === 0 && response.data.data?.task_id) {
        logger.info(`Lipsync task submitted: ${response.data.data.task_id}`);
        return response.data.data.task_id;
      } else if (response && response.data && response.data.task_id) {
        logger.info(`Lipsync task submitted: ${response.data.task_id}`);
        return response.data.task_id;
      } else if (response && response.data.success && response.data.data?.task_id) {
        logger.info(`Lipsync task submitted: ${response.data.data.task_id}`);
        return response.data.data.task_id;
      } else {
        logger.error('Unexpected response format:', {
          hasResponse: !!response,
          hasData: !!response?.data,
          dataKeys: response?.data ? Object.keys(response.data) : 'none',
          fullResponse: response?.data
        });
        throw new Error(response?.data?.error || 'Failed to submit lipsync task');
      }
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
        timeout: 120000
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
    maxWaitTime: number = 300000 // 5 minutes
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
          case 'submitted':
            await new Promise(resolve => setTimeout(resolve, 5000));
            break;
          
          default:
            await new Promise(resolve => setTimeout(resolve, 2000));
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
    onProgress?: (progress: number, status: string) => void
  ): Promise<void> {
    try {
      logger.info(`Starting lipsync processing for video: ${videoPath}, audio: ${audioPath}`);
      
      const taskId = await this.submitLipsyncTask(videoPath, audioPath);
      
      onProgress?.(10, 'Task submitted, waiting for processing...');
      
      const resultUrl = await this.pollTaskUntilComplete(
        taskId,
        (progress, status) => {
          onProgress?.(10 + (progress * 0.8), status);
        }
      );
      
      onProgress?.(90, 'Downloading result...');
      
      await this.downloadResult(resultUrl, outputPath);
      
      onProgress?.(100, 'Complete');
      
      logger.info(`Lipsync processing completed: ${outputPath}`);
    } catch (error: any) {
      logger.error('Error processing segment:', error.message);
      throw error;
    }
  }
}