import axios from 'axios';
import { Segment, VideoMetadata } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

export interface UploadResponse {
  success: boolean;
  sessionId: string;
  metadata: VideoMetadata;
}

export interface SegmentResponse {
  success: boolean;
  segment: Segment;
}

export interface SessionSegmentsResponse {
  sessionId: string;
  segments: Segment[];
  totalCount: number;
}

export interface QueueStatusResponse {
  sessionId: string;
  isProcessing: boolean;
  currentSegmentIndex: number;
  totalSegments: number;
  statusCounts: Record<string, number>;
  segments: Segment[];
}

export const apiService = {
  // Upload API
  async uploadVideo(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('video', file);
    
    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },

  async getSessionInfo(sessionId: string) {
    const response = await api.get(`/upload/session/${sessionId}/info`);
    return response.data;
  },

  async deleteSession(sessionId: string) {
    const response = await api.delete(`/upload/session/${sessionId}`);
    return response.data;
  },

  // Segments API
  async createSegment(sessionId: string, startTime: number, endTime: number): Promise<SegmentResponse> {
    const response = await api.post('/segments', {
      sessionId,
      startTime,
      endTime,
    });
    return response.data;
  },

  async getSessionSegments(sessionId: string): Promise<SessionSegmentsResponse> {
    const response = await api.get(`/segments/session/${sessionId}`);
    return response.data;
  },

  async getSegment(segmentId: string): Promise<Segment> {
    const response = await api.get(`/segments/${segmentId}`);
    return response.data;
  },

  async deleteSegment(segmentId: string) {
    const response = await api.delete(`/segments/${segmentId}`);
    return response.data;
  },

  async updateSegmentApproval(segmentId: string, status: 'approved' | 'rejected') {
    const response = await api.put(`/segments/${segmentId}/approval`, { status });
    return response.data;
  },

  // Queue API
  async startProcessing(sessionId: string, segmentIds: string[]) {
    const response = await api.post('/queue/process', {
      sessionId,
      segmentIds,
    });
    return response.data;
  },

  async cancelProcessing(sessionId: string) {
    const response = await api.post('/queue/cancel', { sessionId });
    return response.data;
  },

  async getQueueStatus(sessionId: string): Promise<QueueStatusResponse> {
    const response = await api.get(`/queue/status/${sessionId}`);
    return response.data;
  },

  // Export API
  async startExport(sessionId: string, format = 'mp4', quality = 'high') {
    const response = await api.post('/export', {
      sessionId,
      format,
      quality,
    });
    return response.data;
  },

  async getExportStatus(sessionId: string) {
    const response = await api.get(`/export/status/${sessionId}`);
    return response.data;
  },

  async cancelExport(sessionId: string) {
    const response = await api.delete(`/export/${sessionId}`);
    return response.data;
  },

  // Utility functions
  getVideoStreamUrl(sessionId: string): string {
    return `${API_BASE_URL}/upload/session/${sessionId}/video`;
  },

  getSegmentVideoUrl(segmentId: string, type: 'original' | 'processed'): string {
    return `${API_BASE_URL}/segments/${segmentId}/video/${type}`;
  },

  getExportDownloadUrl(exportId: string): string {
    return `${API_BASE_URL}/export/download/${exportId}`;
  },
};