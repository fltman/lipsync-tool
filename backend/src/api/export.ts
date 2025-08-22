import express from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { sessionManager, io, logger } from '../index';
import { FFmpegService } from '../services/ffmpeg';
import { ApprovalStatus } from '../types';

const router = express.Router();
const ffmpegService = new FFmpegService();

interface ExportJob {
  sessionId: string;
  exportId: string;
  outputPath: string;
  isRunning: boolean;
}

const activeExports = new Map<string, ExportJob>();

router.post('/', async (req, res) => {
  try {
    const { sessionId, format = 'mp4', quality = 'high' } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (activeExports.has(sessionId)) {
      return res.status(409).json({ 
        error: 'Export already in progress for this session' 
      });
    }

    const processedSegments = session.segments.filter(s => 
      s.approvalStatus === ApprovalStatus.APPROVED || 
      s.approvalStatus === ApprovalStatus.REJECTED
    );

    if (processedSegments.length === 0) {
      return res.status(400).json({ 
        error: 'No segments have been reviewed. Please review all segments before exporting.' 
      });
    }

    const pendingSegments = session.segments.filter(s => 
      s.approvalStatus === ApprovalStatus.PENDING
    );

    if (pendingSegments.length > 0) {
      return res.status(400).json({ 
        error: `${pendingSegments.length} segments still need review before export.`,
        pendingSegments: pendingSegments.map(s => s.id)
      });
    }

    const exportId = uuidv4();
    const tempDir = path.dirname(session.originalVideoPath);
    const outputPath = path.join(tempDir, `export_${exportId}.${format}`);

    const exportJob: ExportJob = {
      sessionId,
      exportId,
      outputPath,
      isRunning: true
    };

    activeExports.set(sessionId, exportJob);

    res.json({ 
      success: true,
      exportId,
      estimatedTime: estimateExportTime(session.segments.length, session.videoMetadata.duration)
    });

    processExport(exportJob);

    logger.info(`Started export job ${exportId} for session ${sessionId}`);
  } catch (error: any) {
    logger.error('Export initialization error:', error.message);
    res.status(500).json({ error: 'Failed to start export' });
  }
});

router.get('/status/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const exportJob = activeExports.get(sessionId);
    
    if (!exportJob) {
      return res.status(404).json({ error: 'No active export found' });
    }

    res.json({
      exportId: exportJob.exportId,
      isRunning: exportJob.isRunning,
      outputPath: exportJob.outputPath
    });
  } catch (error: any) {
    logger.error('Export status error:', error.message);
    res.status(500).json({ error: 'Failed to get export status' });
  }
});

router.get('/download/:exportId', (req, res) => {
  try {
    const { exportId } = req.params;
    
    let exportJob: ExportJob | undefined;
    for (const job of activeExports.values()) {
      if (job.exportId === exportId) {
        exportJob = job;
        break;
      }
    }

    if (!exportJob) {
      return res.status(404).json({ error: 'Export not found' });
    }

    if (exportJob.isRunning) {
      return res.status(425).json({ error: 'Export still in progress' });
    }

    const fs = require('fs');
    if (!fs.existsSync(exportJob.outputPath)) {
      return res.status(404).json({ error: 'Export file not found' });
    }

    const filename = path.basename(exportJob.outputPath);
    const stat = fs.statSync(exportJob.outputPath);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', stat.size);

    const fileStream = fs.createReadStream(exportJob.outputPath);
    fileStream.pipe(res);

    fileStream.on('end', () => {
      logger.info(`Export ${exportId} downloaded`);
      
      setTimeout(() => {
        fs.unlink(exportJob.outputPath, (err: any) => {
          if (err) {
            logger.warn(`Failed to cleanup export file: ${exportJob.outputPath}`);
          } else {
            logger.info(`Cleaned up export file: ${exportJob.outputPath}`);
          }
        });
        activeExports.delete(exportJob.sessionId);
      }, 60000);
    });

  } catch (error: any) {
    logger.error('Export download error:', error.message);
    res.status(500).json({ error: 'Failed to download export' });
  }
});

router.delete('/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const exportJob = activeExports.get(sessionId);
    
    if (!exportJob) {
      return res.status(404).json({ error: 'No active export found' });
    }

    if (exportJob.isRunning) {
      exportJob.isRunning = false;
      io.to(sessionId).emit('export-cancelled', { sessionId, exportId: exportJob.exportId });
    }

    const fs = require('fs');
    if (fs.existsSync(exportJob.outputPath)) {
      fs.unlink(exportJob.outputPath, (err: any) => {
        if (err) {
          logger.warn(`Failed to cleanup cancelled export: ${exportJob.outputPath}`);
        }
      });
    }

    activeExports.delete(sessionId);

    res.json({ success: true });
    logger.info(`Cancelled export ${exportJob.exportId} for session ${sessionId}`);
  } catch (error: any) {
    logger.error('Export cancellation error:', error.message);
    res.status(500).json({ error: 'Failed to cancel export' });
  }
});

async function processExport(exportJob: ExportJob) {
  const { sessionId, exportId, outputPath } = exportJob;
  
  try {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    io.to(sessionId).emit('export-started', { sessionId, exportId });

    const segments = session.segments
      .filter(s => s.approvalStatus !== ApprovalStatus.PENDING)
      .sort((a, b) => a.startTime - b.startTime);

    const replacements = segments.map(segment => ({
      start: segment.startTime,
      end: segment.endTime,
      replacement: segment.approvalStatus === ApprovalStatus.APPROVED 
        ? segment.processedVideoPath 
        : undefined
    }));

    await ffmpegService.splitVideoAtSegments(
      session.originalVideoPath,
      replacements,
      outputPath,
      (progress) => {
        if (exportJob.isRunning) {
          io.to(sessionId).emit('export-progress', {
            sessionId,
            exportId,
            progress
          });
        }
      }
    );

    if (exportJob.isRunning) {
      exportJob.isRunning = false;
      io.to(sessionId).emit('export-completed', {
        sessionId,
        exportId,
        downloadUrl: `/api/export/download/${exportId}`
      });

      logger.info(`Completed export ${exportId} for session ${sessionId}`);
    }

  } catch (error: any) {
    logger.error(`Export ${exportId} failed:`, error.message);
    
    const fs = require('fs');
    if (fs.existsSync(outputPath)) {
      fs.unlink(outputPath, () => {});
    }

    activeExports.delete(sessionId);

    io.to(sessionId).emit('export-failed', {
      sessionId,
      exportId,
      error: error.message
    });
  }
}

function estimateExportTime(segmentCount: number, videoDuration: number): number {
  const baseTime = Math.max(30, videoDuration * 0.1);
  const segmentOverhead = segmentCount * 5;
  return Math.ceil(baseTime + segmentOverhead);
}

export default router;