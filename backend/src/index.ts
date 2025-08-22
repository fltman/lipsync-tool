import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs/promises';
import winston from 'winston';

import uploadRouter from './api/upload';
import segmentsRouter from './api/segments';
import queueRouter from './api/queue';
import exportRouter from './api/export';
import { SessionManager } from './services/session';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const tempPath = path.resolve(process.env.TEMP_STORAGE_PATH || './temp');

async function ensureTempDirectory() {
  try {
    await fs.access(tempPath);
  } catch {
    await fs.mkdir(tempPath, { recursive: true });
    logger.info(`Created temp directory at ${tempPath}`);
  }
}

export const sessionManager = new SessionManager();
export { io, logger };

app.use('/api/upload', uploadRouter);
app.use('/api/segments', segmentsRouter);
app.use('/api/queue', queueRouter);
app.use('/api/export', exportRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve video and audio files publicly for KlingAI API access
// Add middleware to set headers that bypass ngrok warning page
app.use('/api/files', (req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});
app.use('/api/files', express.static(tempPath));

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('join-session', (sessionId: string) => {
    socket.join(sessionId);
    logger.info(`Socket ${socket.id} joined session ${sessionId}`);
  });

  socket.on('leave-session', (sessionId: string) => {
    socket.leave(sessionId);
    logger.info(`Socket ${socket.id} left session ${sessionId}`);
  });

  socket.on('start-processing', async (data: { sessionId: string; segmentIds: string[] }) => {
    logger.info(`Starting processing for session ${data.sessionId}`);
    // Processing will be handled by queue service
  });

  socket.on('cancel-processing', (data: { segmentId: string }) => {
    logger.info(`Canceling processing for segment ${data.segmentId}`);
    // Cancellation logic here
  });

  socket.on('approve-segment', (data: { segmentId: string }) => {
    sessionManager.updateSegmentApproval(data.segmentId, 'approved');
    logger.info(`Segment ${data.segmentId} approved`);
  });

  socket.on('reject-segment', (data: { segmentId: string }) => {
    sessionManager.updateSegmentApproval(data.segmentId, 'rejected');
    logger.info(`Segment ${data.segmentId} rejected`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await ensureTempDirectory();
    
    httpServer.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
      logger.info(`Frontend should connect to WebSocket at ws://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });
});