import express from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { sessionManager, io, logger } from '../index';
import { FFmpegService } from '../services/ffmpeg';
import { KlingAIService } from '../services/klingai';
import { SegmentStatus } from '../types';

const router = express.Router();
const ffmpegService = new FFmpegService();
let klingaiService: KlingAIService | null = null;

function getKlingAIService(): KlingAIService {
  if (!klingaiService) {
    klingaiService = new KlingAIService();
  }
  return klingaiService;
}

interface ProcessingJob {
  sessionId: string;
  segmentIds: string[];
  currentIndex: number;
  isRunning: boolean;
  activeProcessing: Set<string>;
  maxConcurrent: number;
}

const activeJobs = new Map<string, ProcessingJob>();

router.post('/process', async (req, res) => {
  try {
    const { sessionId, segmentIds } = req.body;

    if (!sessionId || !Array.isArray(segmentIds) || segmentIds.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid request: sessionId and segmentIds array required' 
      });
    }

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (activeJobs.has(sessionId)) {
      return res.status(409).json({ 
        error: 'Processing already in progress for this session' 
      });
    }

    const validSegments = segmentIds.filter(id => 
      session.segments.some(s => s.id === id && s.status === SegmentStatus.PENDING)
    );

    if (validSegments.length === 0) {
      return res.status(400).json({ 
        error: 'No valid segments to process' 
      });
    }

    const job: ProcessingJob = {
      sessionId,
      segmentIds: validSegments,
      currentIndex: 0,
      isRunning: true,
      activeProcessing: new Set(),
      maxConcurrent: 4
    };

    activeJobs.set(sessionId, job);

    res.json({ 
      success: true,
      jobId: sessionId,
      segmentCount: validSegments.length 
    });

    processQueue(job);

    logger.info(`Started processing job for session ${sessionId} with ${validSegments.length} segments`);
  } catch (error: any) {
    logger.error('Queue processing error:', error.message);
    res.status(500).json({ error: 'Failed to start processing' });
  }
});

router.post('/cancel', (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    const job = activeJobs.get(sessionId);
    if (!job) {
      return res.status(404).json({ error: 'No active job found for session' });
    }

    job.isRunning = false;
    activeJobs.delete(sessionId);

    io.to(sessionId).emit('processing-cancelled', { sessionId });

    res.json({ success: true });
    logger.info(`Cancelled processing job for session ${sessionId}`);
  } catch (error: any) {
    logger.error('Cancel processing error:', error.message);
    res.status(500).json({ error: 'Failed to cancel processing' });
  }
});

router.get('/status/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessionManager.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const job = activeJobs.get(sessionId);
    const isProcessing = !!job?.isRunning;

    const statusCounts = session.segments.reduce((acc, segment) => {
      acc[segment.status] = (acc[segment.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      sessionId,
      isProcessing,
      currentSegmentIndex: job?.currentIndex || 0,
      totalSegments: session.segments.length,
      statusCounts,
      segments: session.segments.map(s => ({
        id: s.id,
        status: s.status,
        approvalStatus: s.approvalStatus,
        startTime: s.startTime,
        endTime: s.endTime,
        errorMessage: s.errorMessage
      }))
    });
  } catch (error: any) {
    logger.error('Queue status error:', error.message);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

async function processQueue(job: ProcessingJob) {
  const { sessionId, segmentIds } = job;
  
  try {
    const processingPromises: Promise<void>[] = [];
    
    // Process segments with concurrency control
    while (job.currentIndex < segmentIds.length && job.isRunning) {
      // Wait if we've reached max concurrent processing
      while (job.activeProcessing.size >= job.maxConcurrent && job.isRunning) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!job.isRunning) break;
      
      const segmentId = segmentIds[job.currentIndex];
      job.currentIndex++;
      job.activeProcessing.add(segmentId);
      
      // Start processing segment without awaiting
      const processPromise = processSegmentWithCleanup(sessionId, segmentId, job);
      processingPromises.push(processPromise);
    }
    
    // Wait for all segments to complete
    await Promise.all(processingPromises);

    if (job.isRunning) {
      io.to(sessionId).emit('queue-completed', { sessionId });
      logger.info(`Completed processing job for session ${sessionId}`);
    }

  } catch (error: any) {
    logger.error(`Queue processing error for session ${sessionId}:`, error.message);
    io.to(sessionId).emit('queue-failed', {
      sessionId,
      error: error.message
    });
  } finally {
    activeJobs.delete(sessionId);
  }
}

async function processSegmentWithCleanup(sessionId: string, segmentId: string, job: ProcessingJob) {
  try {
    await processSegment(sessionId, segmentId);
  } catch (error: any) {
    logger.error(`Failed to process segment ${segmentId}:`, error.message);
    sessionManager.updateSegmentStatus(segmentId, SegmentStatus.FAILED, error.message);
    
    io.to(sessionId).emit('segment-failed', {
      segmentId,
      error: error.message
    });
  } finally {
    job.activeProcessing.delete(segmentId);
  }
}

async function processSegment(sessionId: string, segmentId: string) {
  const segment = sessionManager.getSegment(segmentId);
  if (!segment) {
    throw new Error('Segment not found');
  }

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const tempDir = path.dirname(session.originalVideoPath);
  const segmentVideoPath = path.join(tempDir, `segment_${segmentId}.mp4`);
  const segmentAudioPath = path.join(tempDir, `segment_${segmentId}.wav`);
  const processedVideoPath = path.join(tempDir, `processed_${segmentId}.mp4`);

  try {
    sessionManager.updateSegmentStatus(segmentId, SegmentStatus.EXTRACTING);
    io.to(sessionId).emit('processing-status', {
      segmentId,
      status: SegmentStatus.EXTRACTING,
      progress: 0
    });

    console.log(`Queue processing segment ${segmentId}: startTime=${segment.startTime}, endTime=${segment.endTime}, duration=${segment.duration}`);
    await ffmpegService.extractSegment(
      segment.originalVideoPath,
      segmentVideoPath,
      segment.startTime,
      segment.duration,
      (progress) => {
        io.to(sessionId).emit('processing-status', {
          segmentId,
          status: SegmentStatus.EXTRACTING,
          progress: Math.floor(progress * 0.3)
        });
      }
    );

    // Verify extracted video metadata
    try {
      const extractedMetadata = await ffmpegService.getVideoMetadata(segmentVideoPath);
      console.log(`Extracted video metadata for ${segmentId}:`, {
        expectedDuration: segment.duration,
        actualDuration: extractedMetadata.duration,
        difference: extractedMetadata.duration - segment.duration,
        startTime: segment.startTime,
        endTime: segment.endTime
      });
    } catch (error) {
      console.error(`Failed to get extracted video metadata for ${segmentId}:`, error);
    }

    await ffmpegService.extractAudio(
      segmentVideoPath,
      segmentAudioPath,
      (progress) => {
        io.to(sessionId).emit('processing-status', {
          segmentId,
          status: SegmentStatus.EXTRACTING,
          progress: 30 + Math.floor(progress * 0.2)
        });
      }
    );

    sessionManager.updateSegmentPaths(segmentId, {
      extractedVideo: segmentVideoPath,
      extractedAudio: segmentAudioPath
    });

    sessionManager.updateSegmentStatus(segmentId, SegmentStatus.UPLOADING);
    io.to(sessionId).emit('processing-status', {
      segmentId,
      status: SegmentStatus.UPLOADING,
      progress: 50
    });

    // Calculate estimated duration for timeout
    const segmentDuration = segment.endTime - segment.startTime;
    
    await getKlingAIService().processSegment(
      segmentVideoPath,
      segmentAudioPath,
      processedVideoPath,
      (progress, status) => {
        let statusEnum: SegmentStatus;
        if (status.includes('processing')) {
          statusEnum = SegmentStatus.PROCESSING;
        } else if (status.includes('uploading') || status.includes('submitted')) {
          statusEnum = SegmentStatus.UPLOADING;
        } else {
          statusEnum = SegmentStatus.PROCESSING;
        }

        sessionManager.updateSegmentStatus(segmentId, statusEnum);
        io.to(sessionId).emit('processing-status', {
          segmentId,
          status: statusEnum,
          progress: 50 + Math.floor(progress * 0.5)
        });
      },
      segmentDuration
    );

    sessionManager.updateSegmentPaths(segmentId, {
      processedVideo: processedVideoPath
    });

    sessionManager.updateSegmentStatus(segmentId, SegmentStatus.COMPLETE);
    io.to(sessionId).emit('processing-status', {
      segmentId,
      status: SegmentStatus.COMPLETE,
      progress: 100
    });

    logger.info(`Successfully processed segment ${segmentId}`);

  } catch (error: any) {
    // TODO: Re-enable cleanup after debugging
    // const fs = require('fs').promises;
    // 
    // try {
    //   await fs.unlink(segmentVideoPath).catch(() => {});
    //   await fs.unlink(segmentAudioPath).catch(() => {});
    //   await fs.unlink(processedVideoPath).catch(() => {});
    // } catch (cleanupError) {
    //   logger.warn(`Failed to cleanup files for segment ${segmentId}`);
    // }

    logger.warn(`Keeping segment files for debugging: ${segmentVideoPath}, ${segmentAudioPath}`);
    throw error;
  }
}

export default router;