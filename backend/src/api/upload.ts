import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FFmpegService } from '../services/ffmpeg';
import { sessionManager, logger } from '../index';

const router = express.Router();
const ffmpegService = new FFmpegService();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempPath = path.resolve(process.env.TEMP_STORAGE_PATH || './temp');
    cb(null, tempPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `upload_${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${ext}. Allowed types: ${allowedTypes.join(', ')}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '2147483648') // 2GB default
  }
});

router.post('/', (req, res, next) => {
  upload.single('video')(req, res, async (err) => {
    try {
      // Handle multer errors
      if (err) {
        logger.error('Multer upload error:', err);
        
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ 
            error: 'File too large',
            details: 'Maximum file size is 2GB'
          });
        }
        
        if (err.message && err.message.includes('Unsupported file type')) {
          return res.status(400).json({ 
            error: 'Unsupported file type',
            details: err.message
          });
        }
        
        return res.status(400).json({ 
          error: 'Upload failed',
          details: err.message || 'Unknown upload error'
        });
      }

      if (!req.file) {
        logger.error('No file received in upload request');
        return res.status(400).json({ 
          error: 'No video file provided',
          details: 'Please select a video file to upload'
        });
      }

      const videoPath = req.file.path;
      logger.info(`Video uploaded successfully: ${videoPath}, size: ${req.file.size} bytes`);

      const metadata = await ffmpegService.getVideoMetadata(videoPath);
      const session = sessionManager.createSession(videoPath, metadata);

      res.json({
        success: true,
        sessionId: session.id,
        metadata: {
          duration: metadata.duration,
          resolution: metadata.resolution,
          framerate: metadata.framerate,
          codec: metadata.codec,
          format: metadata.format,
          size: metadata.size,
          filename: req.file.originalname
        }
      });

      logger.info(`Session created: ${session.id} for video: ${req.file.originalname}`);
    } catch (error: any) {
      logger.error('Upload processing error:', error);
      logger.error('Error stack:', error.stack);
      
      res.status(500).json({ 
        error: 'Failed to process uploaded video',
        details: error.message || 'Unknown error occurred'
      });
    }
  });
});

router.get('/session/:sessionId/video', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessionManager.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const videoPath = session.originalVideoPath;
    
    if (!videoPath) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const stat = require('fs').statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = require('fs').createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      require('fs').createReadStream(videoPath).pipe(res);
    }
  } catch (error: any) {
    logger.error('Video streaming error:', error.message);
    res.status(500).json({ error: 'Failed to stream video' });
  }
});

router.get('/session/:sessionId/info', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessionManager.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      sessionId: session.id,
      metadata: session.videoMetadata,
      segmentCount: session.segments.length,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    });
  } catch (error: any) {
    logger.error('Session info error:', error.message);
    res.status(500).json({ error: 'Failed to get session info' });
  }
});

router.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessionManager.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const fs = require('fs').promises;
    
    try {
      await fs.unlink(session.originalVideoPath);
    } catch (e) {
      logger.warn(`Failed to delete original video: ${session.originalVideoPath}`);
    }

    for (const segment of session.segments) {
      if (segment.extractedVideoPath) {
        try {
          await fs.unlink(segment.extractedVideoPath);
        } catch (e) {}
      }
      if (segment.extractedAudioPath) {
        try {
          await fs.unlink(segment.extractedAudioPath);
        } catch (e) {}
      }
      if (segment.processedVideoPath) {
        try {
          await fs.unlink(segment.processedVideoPath);
        } catch (e) {}
      }
    }

    sessionManager.clearQueue(sessionId);
    
    res.json({ success: true });
    logger.info(`Session deleted: ${sessionId}`);
  } catch (error: any) {
    logger.error('Session deletion error:', error.message);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;