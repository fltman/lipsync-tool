import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Session } from '../App';
import { Segment, ProcessingProgress, ExportProgress, SegmentStatus } from '../types';
import { apiService } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import VideoPlayer from './VideoPlayer';
import SegmentQueue from './SegmentQueue';
import ReviewPanel from './ReviewPanel';
import ExportPanel from './ExportPanel';
import { ArrowLeft, Play, Pause, Settings } from 'lucide-react';

interface MainWorkspaceProps {
  session: Session;
  onNewSession: () => void;
}

const MainWorkspace: React.FC<MainWorkspaceProps> = ({ session, onNewSession }) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [processingProgress, setProcessingProgress] = useState<Record<string, ProcessingProgress>>({});
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'review' | 'export'>('edit');

  const queryClient = useQueryClient();

  // Fetch segments
  const { data: segmentsData, refetch: refetchSegments } = useQuery({
    queryKey: ['segments', session.id],
    queryFn: () => apiService.getSessionSegments(session.id),
    refetchInterval: 5000,
  });

  // Fetch queue status
  const { data: queueStatus } = useQuery({
    queryKey: ['queue-status', session.id],
    queryFn: () => apiService.getQueueStatus(session.id),
    refetchInterval: 2000,
  });

  // WebSocket callbacks
  const webSocketCallbacks = {
    onProcessingStatus: useCallback((data: ProcessingProgress) => {
      setProcessingProgress(prev => ({
        ...prev,
        [data.segmentId]: data
      }));
      
      // Refetch segments when processing completes
      if (data.status === SegmentStatus.COMPLETE || data.status === SegmentStatus.FAILED) {
        refetchSegments();
      }
    }, [refetchSegments]),

    onSegmentFailed: useCallback((data: { segmentId: string; error: string }) => {
      console.error(`Segment ${data.segmentId} failed:`, data.error);
      refetchSegments();
    }, [refetchSegments]),

    onQueueCompleted: useCallback((data: { sessionId: string }) => {
      console.log('Queue processing completed');
      setProcessingProgress({});
      refetchSegments();
      queryClient.invalidateQueries({ queryKey: ['queue-status', session.id] });
    }, [refetchSegments, queryClient, session.id]),

    onQueueFailed: useCallback((data: { sessionId: string; error: string }) => {
      console.error('Queue processing failed:', data.error);
      setProcessingProgress({});
      refetchSegments();
      queryClient.invalidateQueries({ queryKey: ['queue-status', session.id] });
    }, [refetchSegments, queryClient, session.id]),

    onExportStarted: useCallback((data: { sessionId: string; exportId: string }) => {
      console.log('Export started:', data.exportId);
      setExportProgress({ sessionId: data.sessionId, exportId: data.exportId, progress: 0 });
    }, []),

    onExportProgress: useCallback((data: ExportProgress) => {
      setExportProgress(data);
    }, []),

    onExportCompleted: useCallback((data: { sessionId: string; exportId: string; downloadUrl: string }) => {
      console.log('Export completed:', data.downloadUrl);
      setExportProgress(null);
      
      // Automatically download the file
      const link = document.createElement('a');
      link.href = apiService.getExportDownloadUrl(data.exportId);
      link.download = `lipsync_export_${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, []),

    onExportFailed: useCallback((data: { sessionId: string; exportId: string; error: string }) => {
      console.error('Export failed:', data.error);
      setExportProgress(null);
    }, []),
  };

  const { isConnected } = useWebSocket(session.id, webSocketCallbacks);

  const handleSegmentCreate = useCallback(async (startTime: number, endTime: number) => {
    try {
      await apiService.createSegment(session.id, startTime, endTime);
      refetchSegments();
    } catch (error: any) {
      console.error('Failed to create segment:', error);
      alert(error.response?.data?.error || 'Failed to create segment');
    }
  }, [session.id, refetchSegments]);

  const handleSegmentDelete = useCallback(async (segmentId: string) => {
    try {
      await apiService.deleteSegment(segmentId);
      refetchSegments();
      if (selectedSegment?.id === segmentId) {
        setSelectedSegment(null);
      }
    } catch (error: any) {
      console.error('Failed to delete segment:', error);
      alert(error.response?.data?.error || 'Failed to delete segment');
    }
  }, [refetchSegments, selectedSegment]);

  const handleStartProcessing = useCallback(async () => {
    if (!segmentsData?.segments.length) return;

    const pendingSegments = segmentsData.segments.filter(s => s.status === SegmentStatus.PENDING);
    if (pendingSegments.length === 0) {
      alert('No pending segments to process');
      return;
    }

    try {
      await apiService.startProcessing(session.id, pendingSegments.map(s => s.id));
      queryClient.invalidateQueries({ queryKey: ['queue-status', session.id] });
    } catch (error: any) {
      console.error('Failed to start processing:', error);
      alert(error.response?.data?.error || 'Failed to start processing');
    }
  }, [session.id, segmentsData, queryClient]);

  const handleSegmentApproval = useCallback(async (segmentId: string, approved: boolean) => {
    try {
      await apiService.updateSegmentApproval(segmentId, approved ? 'approved' : 'rejected');
      refetchSegments();
    } catch (error: any) {
      console.error('Failed to update segment approval:', error);
      alert(error.response?.data?.error || 'Failed to update segment approval');
    }
  }, [refetchSegments]);

  const handleExport = useCallback(async () => {
    try {
      await apiService.startExport(session.id);
      setActiveTab('export');
    } catch (error: any) {
      console.error('Failed to start export:', error);
      alert(error.response?.data?.error || 'Failed to start export');
    }
  }, [session.id]);

  const handleRetrySegment = useCallback(async (segmentId: string) => {
    try {
      // Reset segment status to pending so it can be processed again
      const segment = segmentsData?.segments.find(s => s.id === segmentId);
      if (segment && segment.status === 'failed') {
        await apiService.startProcessing(session.id, [segmentId]);
        queryClient.invalidateQueries({ queryKey: ['queue-status', session.id] });
        refetchSegments();
      }
    } catch (error: any) {
      console.error('Failed to retry segment:', error);
      alert(error.response?.data?.error || 'Failed to retry segment');
    }
  }, [session.id, segmentsData, queryClient, refetchSegments]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
  };

  const completedSegments = segmentsData?.segments.filter(s => s.status === SegmentStatus.COMPLETE) || [];
  const reviewedSegments = completedSegments.filter(s => s.approvalStatus !== 'pending') || [];

  return (
    <div className="main-workspace">
      <header className="workspace-header">
        <div className="header-left">
          <button onClick={onNewSession} className="back-button">
            <ArrowLeft size={20} />
            New Video
          </button>
          <div className="video-info">
            <h2>{session.metadata.filename}</h2>
            <div className="video-stats">
              <span>{formatDuration(session.metadata.duration)}</span>
              <span>{session.metadata.resolution.width}×{session.metadata.resolution.height}</span>
              <span>{session.metadata.framerate.toFixed(1)} fps</span>
            </div>
          </div>
        </div>
        
        <div className="header-right">
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
        </div>
      </header>

      <div className="workspace-tabs">
        <button 
          className={`tab ${activeTab === 'edit' ? 'active' : ''}`}
          onClick={() => setActiveTab('edit')}
        >
          Edit & Process
        </button>
        <button 
          className={`tab ${activeTab === 'review' ? 'active' : ''}`}
          onClick={() => setActiveTab('review')}
          disabled={completedSegments.length === 0}
        >
          Review ({completedSegments.length})
        </button>
        <button 
          className={`tab ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
          disabled={reviewedSegments.length === 0}
        >
          Export
        </button>
      </div>

      <div className="workspace-content">
        {activeTab === 'edit' && (
          <>
            <div className="video-section">
              <VideoPlayer
                sessionId={session.id}
                duration={session.metadata.duration}
                currentTime={currentTime}
                isPlaying={isPlaying}
                onTimeUpdate={setCurrentTime}
                onPlayStateChange={setIsPlaying}
                segments={segmentsData?.segments || []}
                onSegmentCreate={handleSegmentCreate}
                selectedSegment={selectedSegment}
                onSegmentSelect={setSelectedSegment}
              />
            </div>
            
            <div className="queue-section">
              <SegmentQueue
                segments={segmentsData?.segments || []}
                onSegmentDelete={handleSegmentDelete}
                onSegmentSelect={setSelectedSegment}
                onStartProcessing={handleStartProcessing}
                onRetrySegment={handleRetrySegment}
                processingProgress={processingProgress}
                queueStatus={queueStatus}
              />
            </div>
          </>
        )}

        {activeTab === 'review' && (
          <ReviewPanel
            segments={completedSegments}
            onSegmentApproval={handleSegmentApproval}
            selectedSegment={selectedSegment}
            onSegmentSelect={setSelectedSegment}
          />
        )}

        {activeTab === 'export' && (
          <ExportPanel
            segments={segmentsData?.segments || []}
            exportProgress={exportProgress}
            onExport={handleExport}
          />
        )}
      </div>
    </div>
  );
};

export default MainWorkspace;