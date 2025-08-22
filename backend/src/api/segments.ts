import express from 'express';
import path from 'path';
import { sessionManager, logger } from '../index';

const router = express.Router();

router.post('/', (req, res) => {
  try {
    const { sessionId, startTime, endTime } = req.body;
    logger.info(`Segment API received: sessionId=${sessionId}, startTime=${startTime}, endTime=${endTime}, duration=${endTime - startTime}`);

    if (!sessionId || startTime === undefined || endTime === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: sessionId, startTime, endTime' 
      });
    }

    if (startTime < 0 || endTime <= startTime) {
      return res.status(400).json({ 
        error: 'Invalid time range: endTime must be greater than startTime and both must be positive' 
      });
    }

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const duration = endTime - startTime;
    if (duration < 0.5) {
      return res.status(400).json({ 
        error: 'Segment too short: minimum duration is 0.5 seconds' 
      });
    }

    if (duration > 60) {
      return res.status(400).json({ 
        error: 'Segment too long: maximum duration is 60 seconds' 
      });
    }

    const existingOverlap = session.segments.find(segment => 
      (startTime < segment.endTime && endTime > segment.startTime)
    );

    if (existingOverlap) {
      return res.status(400).json({ 
        error: 'Segment overlaps with existing segment',
        conflictingSegment: {
          id: existingOverlap.id,
          startTime: existingOverlap.startTime,
          endTime: existingOverlap.endTime
        }
      });
    }

    const segment = sessionManager.addSegment(sessionId, startTime, endTime);
    if (!segment) {
      return res.status(500).json({ error: 'Failed to create segment' });
    }

    res.json({
      success: true,
      segment: {
        id: segment.id,
        sessionId: segment.sessionId,
        startTime: segment.startTime,
        endTime: segment.endTime,
        duration: segment.duration,
        status: segment.status,
        approvalStatus: segment.approvalStatus,
        createdAt: segment.createdAt
      }
    });

    logger.info(`Segment created: ${segment.id} (${startTime}s - ${endTime}s)`);
  } catch (error: any) {
    logger.error('Segment creation error:', error.message);
    res.status(500).json({ error: 'Failed to create segment' });
  }
});

router.get('/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessionManager.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const segments = session.segments.map(segment => ({
      id: segment.id,
      sessionId: segment.sessionId,
      startTime: segment.startTime,
      endTime: segment.endTime,
      duration: segment.duration,
      status: segment.status,
      approvalStatus: segment.approvalStatus,
      errorMessage: segment.errorMessage,
      retryCount: segment.retryCount,
      createdAt: segment.createdAt,
      updatedAt: segment.updatedAt
    }));

    res.json({
      sessionId,
      segments: segments.sort((a, b) => a.startTime - b.startTime),
      totalCount: segments.length
    });
  } catch (error: any) {
    logger.error('Get segments error:', error.message);
    res.status(500).json({ error: 'Failed to get segments' });
  }
});

router.get('/:segmentId', (req, res) => {
  try {
    const { segmentId } = req.params;
    const segment = sessionManager.getSegment(segmentId);
    
    if (!segment) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    res.json({
      id: segment.id,
      sessionId: segment.sessionId,
      startTime: segment.startTime,
      endTime: segment.endTime,
      duration: segment.duration,
      status: segment.status,
      approvalStatus: segment.approvalStatus,
      errorMessage: segment.errorMessage,
      retryCount: segment.retryCount,
      hasExtractedVideo: !!segment.extractedVideoPath,
      hasExtractedAudio: !!segment.extractedAudioPath,
      hasProcessedVideo: !!segment.processedVideoPath,
      createdAt: segment.createdAt,
      updatedAt: segment.updatedAt
    });
  } catch (error: any) {
    logger.error('Get segment error:', error.message);
    res.status(500).json({ error: 'Failed to get segment' });
  }
});

router.delete('/:segmentId', (req, res) => {
  try {
    const { segmentId } = req.params;
    const segment = sessionManager.getSegment(segmentId);
    
    if (!segment) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    if (segment.status === 'processing' || segment.status === 'uploading') {
      return res.status(400).json({ 
        error: 'Cannot delete segment while processing' 
      });
    }

    const success = sessionManager.removeSegment(segment.sessionId, segmentId);
    if (!success) {
      return res.status(500).json({ error: 'Failed to remove segment' });
    }

    const fs = require('fs').promises;
    
    const cleanup = async () => {
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
    };

    cleanup();

    res.json({ success: true });
    logger.info(`Segment deleted: ${segmentId}`);
  } catch (error: any) {
    logger.error('Segment deletion error:', error.message);
    res.status(500).json({ error: 'Failed to delete segment' });
  }
});

router.put('/:segmentId/approval', (req, res) => {
  try {
    const { segmentId } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid approval status. Must be "approved" or "rejected"' 
      });
    }

    const segment = sessionManager.getSegment(segmentId);
    if (!segment) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    if (segment.status !== 'complete') {
      return res.status(400).json({ 
        error: 'Cannot approve/reject segment that is not complete' 
      });
    }

    const success = sessionManager.updateSegmentApproval(segmentId, status);
    if (!success) {
      return res.status(500).json({ error: 'Failed to update segment approval' });
    }

    res.json({ 
      success: true, 
      segmentId,
      approvalStatus: status 
    });

    logger.info(`Segment ${segmentId} ${status}`);
  } catch (error: any) {
    logger.error('Segment approval error:', error.message);
    res.status(500).json({ error: 'Failed to update segment approval' });
  }
});

router.get('/:segmentId/video/:type', (req, res) => {
  try {
    const { segmentId, type } = req.params;
    const segment = sessionManager.getSegment(segmentId);
    
    if (!segment) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    let videoPath: string | undefined;
    
    switch (type) {
      case 'original':
        videoPath = segment.extractedVideoPath;
        break;
      case 'processed':
        videoPath = segment.processedVideoPath;
        break;
      default:
        return res.status(400).json({ error: 'Invalid video type. Must be "original" or "processed"' });
    }

    if (!videoPath) {
      return res.status(404).json({ error: `${type} video not available` });
    }

    const fs = require('fs');
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
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
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error: any) {
    logger.error('Segment video streaming error:', error.message);
    res.status(500).json({ error: 'Failed to stream segment video' });
  }
});

export default router;