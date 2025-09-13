import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';

export interface StorageConfig {
  endpoint?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export class CloudStorageService {
  private s3Client?: S3Client;
  private bucketName: string;
  private isConfigured: boolean;

  constructor() {
    // Check if cloud storage is configured
    const endpoint = process.env.R2_ENDPOINT || process.env.S3_ENDPOINT;
    const region = process.env.R2_REGION || process.env.AWS_REGION || 'auto';
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '';
    this.bucketName = process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME || '';

    this.isConfigured = !!(accessKeyId && secretAccessKey && this.bucketName);

    if (this.isConfigured) {
      const config: any = {
        region,
        credentials: {
          accessKeyId,
          secretAccessKey
        }
      };

      // Add endpoint for R2 or other S3-compatible services
      if (endpoint) {
        config.endpoint = endpoint;
        config.forcePathStyle = true; // Required for S3-compatible services
      }

      this.s3Client = new S3Client(config);
      console.log(`Cloud storage configured: ${endpoint ? 'R2/S3-compatible' : 'AWS S3'} in region ${region}`);
    } else {
      console.warn('Cloud storage not configured - falling back to ngrok/local serving');
    }
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * Upload a file to cloud storage and return a public URL
   */
  async uploadFile(
    filePath: string, 
    key?: string,
    expiresIn: number = 3600 // Default 1 hour expiry
  ): Promise<string> {
    if (!this.isConfigured) {
      throw new Error('Cloud storage not configured');
    }

    try {
      const fileKey = key || `lipsync/${Date.now()}_${path.basename(filePath)}`;
      const fileStream = fs.createReadStream(filePath);
      const stats = fs.statSync(filePath);

      // Determine content type based on file extension
      const ext = path.extname(filePath).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.mp4') contentType = 'video/mp4';
      else if (ext === '.wav') contentType = 'audio/wav';
      else if (ext === '.mp3') contentType = 'audio/mp3';
      else if (ext === '.webm') contentType = 'video/webm';

      const uploadParams = {
        Bucket: this.bucketName,
        Key: fileKey,
        Body: fileStream,
        ContentType: contentType,
        ContentLength: stats.size
      };

      await this.s3Client!.send(new PutObjectCommand(uploadParams));
      console.info(`Uploaded file to cloud storage: ${fileKey}`);

      // Generate a presigned URL for the uploaded file
      const url = await this.getSignedUrl(fileKey, expiresIn);
      return url;
    } catch (error: any) {
      console.error('Cloud storage upload error:', error);
      throw new Error(`Failed to upload to cloud storage: ${error.message}`);
    }
  }

  /**
   * Generate a presigned URL for a file
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!this.isConfigured) {
      throw new Error('Cloud storage not configured');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const url = await getSignedUrl(this.s3Client!, command, { expiresIn });
      return url;
    } catch (error: any) {
      console.error('Error generating signed URL:', error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Delete a file from cloud storage
   */
  async deleteFile(key: string): Promise<void> {
    if (!this.isConfigured) {
      return; // Silently skip if not configured
    }

    try {
      await this.s3Client!.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      }));
      console.info(`Deleted file from cloud storage: ${key}`);
    } catch (error: any) {
      console.error('Cloud storage deletion error:', error);
      // Don't throw - cleanup failures shouldn't break the flow
    }
  }

  /**
   * Delete multiple files from cloud storage
   */
  async deleteFiles(keys: string[]): Promise<void> {
    if (!this.isConfigured || keys.length === 0) {
      return;
    }

    // Delete files one by one (could be optimized with batch delete)
    for (const key of keys) {
      await this.deleteFile(key);
    }
  }

  /**
   * Upload video and audio files for KlingAI processing
   */
  async uploadForProcessing(
    videoPath: string,
    audioPath: string
  ): Promise<{ videoUrl: string; audioUrl: string; keys: string[] }> {
    const timestamp = Date.now();
    const sessionId = path.basename(path.dirname(videoPath));
    
    const videoKey = `lipsync/${sessionId}/${timestamp}_video.mp4`;
    const audioKey = `lipsync/${sessionId}/${timestamp}_audio.wav`;

    // Upload with 2 hour expiry (should be enough for KlingAI processing)
    const videoUrl = await this.uploadFile(videoPath, videoKey, 7200);
    const audioUrl = await this.uploadFile(audioPath, audioKey, 7200);

    return {
      videoUrl,
      audioUrl,
      keys: [videoKey, audioKey]
    };
  }
}

let _instance: CloudStorageService | null = null;

export const cloudStorage = {
  get instance(): CloudStorageService {
    if (!_instance) {
      _instance = new CloudStorageService();
    }
    return _instance;
  },
  
  isAvailable(): boolean {
    return this.instance.isAvailable();
  },
  
  async uploadFile(filePath: string, key?: string, expiresIn?: number): Promise<string> {
    return this.instance.uploadFile(filePath, key, expiresIn);
  },
  
  async uploadForProcessing(videoPath: string, audioPath: string) {
    return this.instance.uploadForProcessing(videoPath, audioPath);
  },
  
  async deleteFiles(keys: string[]): Promise<void> {
    return this.instance.deleteFiles(keys);
  }
};