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
}

export interface Segment {
  id: string;
  sessionId: string;
  startTime: number;
  endTime: number;
  duration: number;
  originalVideoPath: string;
  extractedVideoPath?: string;
  extractedAudioPath?: string;
  processedVideoPath?: string;
  status: SegmentStatus;
  approvalStatus: ApprovalStatus;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
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

export interface Session {
  id: string;
  originalVideoPath: string;
  videoMetadata: VideoMetadata;
  segments: Segment[];
  currentProcessingIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueueItem {
  segmentId: string;
  order: number;
}

export interface ProcessingProgress {
  segmentId: string;
  status: SegmentStatus;
  progress: number;
  message?: string;
}

export interface ExportOptions {
  format: string;
  quality: string;
  bitrate?: string;
}