import { v4 as uuidv4 } from 'uuid';
import { Session, Segment, VideoMetadata, SegmentStatus, ApprovalStatus } from '../types';
import { logger } from '../index';

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private segmentToSession: Map<string, string> = new Map();

  createSession(videoPath: string, metadata: VideoMetadata): Session {
    const session: Session = {
      id: uuidv4(),
      originalVideoPath: videoPath,
      videoMetadata: metadata,
      segments: [],
      currentProcessingIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.sessions.set(session.id, session);
    logger.info(`Created session ${session.id}`);
    
    this.scheduleCleanup(session.id);
    
    return session;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  addSegment(sessionId: string, startTime: number, endTime: number): Segment | null {
    console.log(`SessionManager.addSegment called with: startTime=${startTime}, endTime=${endTime}, duration=${endTime - startTime}`);
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const segment: Segment = {
      id: uuidv4(),
      sessionId,
      startTime,
      endTime,
      duration: endTime - startTime,
      originalVideoPath: session.originalVideoPath,
      status: SegmentStatus.PENDING,
      approvalStatus: ApprovalStatus.PENDING,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    session.segments.push(segment);
    session.updatedAt = new Date();
    this.segmentToSession.set(segment.id, sessionId);
    
    logger.info(`Added segment ${segment.id} to session ${sessionId}`);
    
    return segment;
  }

  updateSegmentStatus(segmentId: string, status: SegmentStatus, errorMessage?: string): boolean {
    const sessionId = this.segmentToSession.get(segmentId);
    if (!sessionId) return false;

    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const segment = session.segments.find(s => s.id === segmentId);
    if (!segment) return false;

    segment.status = status;
    segment.updatedAt = new Date();
    if (errorMessage) {
      segment.errorMessage = errorMessage;
    }

    session.updatedAt = new Date();
    
    logger.info(`Updated segment ${segmentId} status to ${status}`);
    
    return true;
  }

  updateSegmentPaths(
    segmentId: string, 
    paths: { 
      extractedVideo?: string; 
      extractedAudio?: string; 
      processedVideo?: string; 
    }
  ): boolean {
    const sessionId = this.segmentToSession.get(segmentId);
    if (!sessionId) return false;

    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const segment = session.segments.find(s => s.id === segmentId);
    if (!segment) return false;

    if (paths.extractedVideo) segment.extractedVideoPath = paths.extractedVideo;
    if (paths.extractedAudio) segment.extractedAudioPath = paths.extractedAudio;
    if (paths.processedVideo) segment.processedVideoPath = paths.processedVideo;
    
    segment.updatedAt = new Date();
    session.updatedAt = new Date();
    
    return true;
  }

  updateSegmentApproval(segmentId: string, status: 'approved' | 'rejected'): boolean {
    const sessionId = this.segmentToSession.get(segmentId);
    if (!sessionId) return false;

    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const segment = session.segments.find(s => s.id === segmentId);
    if (!segment) return false;

    segment.approvalStatus = status === 'approved' ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;
    segment.updatedAt = new Date();
    session.updatedAt = new Date();
    
    logger.info(`Updated segment ${segmentId} approval to ${status}`);
    
    return true;
  }

  getSegment(segmentId: string): Segment | undefined {
    const sessionId = this.segmentToSession.get(segmentId);
    if (!sessionId) return undefined;

    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    return session.segments.find(s => s.id === segmentId);
  }

  removeSegment(sessionId: string, segmentId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const index = session.segments.findIndex(s => s.id === segmentId);
    if (index === -1) return false;

    session.segments.splice(index, 1);
    session.updatedAt = new Date();
    this.segmentToSession.delete(segmentId);
    
    logger.info(`Removed segment ${segmentId} from session ${sessionId}`);
    
    return true;
  }

  clearQueue(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.segments.forEach(segment => {
      this.segmentToSession.delete(segment.id);
    });
    
    session.segments = [];
    session.currentProcessingIndex = 0;
    session.updatedAt = new Date();
    
    logger.info(`Cleared queue for session ${sessionId}`);
    
    return true;
  }

  private scheduleCleanup(sessionId: string) {
    const timeout = parseInt(process.env.SESSION_TIMEOUT || '3600000');
    
    setTimeout(() => {
      const session = this.sessions.get(sessionId);
      if (session) {
        const timeSinceUpdate = Date.now() - session.updatedAt.getTime();
        if (timeSinceUpdate >= timeout) {
          this.cleanupSession(sessionId);
        } else {
          this.scheduleCleanup(sessionId);
        }
      }
    }, timeout);
  }

  private cleanupSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.segments.forEach(segment => {
        this.segmentToSession.delete(segment.id);
      });
      this.sessions.delete(sessionId);
      logger.info(`Cleaned up session ${sessionId}`);
    }
  }
}