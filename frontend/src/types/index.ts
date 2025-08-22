export interface VideoMetadata {
  duration: number;
  resolution: {
    width: number;
    height: number;
  };
  framerate: number;
  codec: string;
  format: string;
  size: number;
  filename: string;
}

export interface Segment {
  id: string;
  sessionId: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: SegmentStatus;
  approvalStatus: ApprovalStatus;
  errorMessage?: string;
  retryCount: number;
  hasExtractedVideo: boolean;
  hasExtractedAudio: boolean;
  hasProcessedVideo: boolean;
  createdAt: string;
  updatedAt: string;
}

export enum SegmentStatus {
  PENDING = 'pending',
  EXTRACTING = 'extracting',
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  COMPLETE = 'complete',
  FAILED = 'failed'
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export interface ProcessingProgress {
  segmentId: string;
  status: SegmentStatus;
  progress: number;
  message?: string;
}

export interface ExportProgress {
  sessionId: string;
  exportId: string;
  progress: number;
}