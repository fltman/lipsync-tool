import React from 'react';
import { Trash2, Play, Clock, CheckCircle, AlertCircle, Loader, RotateCw } from 'lucide-react';
import { Segment, SegmentStatus, ProcessingProgress } from '../types';
import { apiService } from '../services/api';

interface SegmentQueueProps {
  segments: Segment[];
  onSegmentDelete: (segmentId: string) => void;
  onSegmentSelect: (segment: Segment) => void;
  onStartProcessing: () => void;
  onRetrySegment?: (segmentId: string) => void;
  processingProgress: Record<string, ProcessingProgress>;
  queueStatus?: {
    isProcessing: boolean;
    currentSegmentIndex: number;
    totalSegments: number;
    statusCounts: Record<string, number>;
  };
}

const SegmentQueue: React.FC<SegmentQueueProps> = ({
  segments,
  onSegmentDelete,
  onSegmentSelect,
  onStartProcessing,
  onRetrySegment,
  processingProgress,
  queueStatus,
}) => {
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${minutes}:${secs.padStart(4, '0')}`;
  };

  const formatDuration = (seconds: number): string => {
    return `${seconds.toFixed(1)}s`;
  };

  const getStatusIcon = (segment: Segment) => {
    const progress = processingProgress[segment.id];
    
    switch (segment.status) {
      case SegmentStatus.PENDING:
        return <Clock size={16} className="text-gray-400" />;
      case SegmentStatus.EXTRACTING:
      case SegmentStatus.UPLOADING:
      case SegmentStatus.PROCESSING:
        return <Loader size={16} className="text-blue-500 animate-spin" />;
      case SegmentStatus.COMPLETE:
        return <CheckCircle size={16} className="text-green-500" />;
      case SegmentStatus.FAILED:
        return <AlertCircle size={16} className="text-red-500" />;
      default:
        return <Clock size={16} className="text-gray-400" />;
    }
  };

  const getStatusText = (segment: Segment) => {
    const progress = processingProgress[segment.id];
    
    if (progress) {
      return `${progress.status} (${progress.progress}%)`;
    }
    
    switch (segment.status) {
      case SegmentStatus.PENDING:
        return 'Pending';
      case SegmentStatus.EXTRACTING:
        return 'Extracting';
      case SegmentStatus.UPLOADING:
        return 'Uploading';
      case SegmentStatus.PROCESSING:
        return 'Processing';
      case SegmentStatus.COMPLETE:
        return 'Complete';
      case SegmentStatus.FAILED:
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  const getProgressPercentage = (segment: Segment) => {
    const progress = processingProgress[segment.id];
    return progress?.progress || 0;
  };

  const pendingSegments = segments.filter(s => s.status === SegmentStatus.PENDING);
  const processingSegments = segments.filter(s => 
    [SegmentStatus.EXTRACTING, SegmentStatus.UPLOADING, SegmentStatus.PROCESSING].includes(s.status)
  );
  const completedSegments = segments.filter(s => s.status === SegmentStatus.COMPLETE);
  const failedSegments = segments.filter(s => s.status === SegmentStatus.FAILED);

  return (
    <div className="segment-queue">
      <div className="queue-header">
        <h3>Segment Queue</h3>
        <div className="queue-stats">
          <span className="stat">
            <span className="stat-value">{segments.length}</span>
            <span className="stat-label">Total</span>
          </span>
          <span className="stat">
            <span className="stat-value">{pendingSegments.length}</span>
            <span className="stat-label">Pending</span>
          </span>
          <span className="stat">
            <span className="stat-value">{processingSegments.length}</span>
            <span className="stat-label">Processing</span>
          </span>
          <span className="stat">
            <span className="stat-value">{completedSegments.length}</span>
            <span className="stat-label">Complete</span>
          </span>
          {failedSegments.length > 0 && (
            <span className="stat error">
              <span className="stat-value">{failedSegments.length}</span>
              <span className="stat-label">Failed</span>
            </span>
          )}
        </div>
      </div>

      <div className="queue-controls">
        <button
          onClick={onStartProcessing}
          disabled={pendingSegments.length === 0 || queueStatus?.isProcessing}
          className="start-processing-button"
        >
          {queueStatus?.isProcessing ? (
            <>
              <Loader size={16} className="animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Play size={16} />
              Process Queue ({pendingSegments.length})
            </>
          )}
        </button>
        
        {queueStatus?.isProcessing && (
          <div className="processing-status">
            Processing segment {queueStatus.currentSegmentIndex + 1} of {queueStatus.totalSegments}
          </div>
        )}
      </div>

      <div className="segment-list">
        {segments.length === 0 ? (
          <div className="empty-queue">
            <p>No segments added yet.</p>
            <p>Use the timeline controls to mark in/out points and create segments.</p>
          </div>
        ) : (
          <div className="segments">
            {segments
              .sort((a, b) => a.startTime - b.startTime)
              .map((segment, index) => (
                <div
                  key={segment.id}
                  className={`segment-item status-${segment.status}`}
                  onClick={() => onSegmentSelect(segment)}
                >
                  <div className="segment-number">#{index + 1}</div>
                  
                  <div className="segment-times">
                    <div className="time-range">
                      {formatTime(segment.startTime)} → {formatTime(segment.endTime)}
                    </div>
                    <div className="duration">
                      {formatDuration(segment.duration)}
                    </div>
                  </div>

                  <div className="segment-status">
                    <div className="status-icon">
                      {getStatusIcon(segment)}
                    </div>
                    <div className="status-text">
                      {getStatusText(segment)}
                    </div>
                  </div>

                  {(segment.status === SegmentStatus.EXTRACTING || 
                    segment.status === SegmentStatus.UPLOADING || 
                    segment.status === SegmentStatus.PROCESSING) && (
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${getProgressPercentage(segment)}%` }}
                      />
                    </div>
                  )}

                  {segment.status === SegmentStatus.FAILED && segment.errorMessage && (
                    <div className="error-message" title={segment.errorMessage}>
                      {segment.errorMessage}
                    </div>
                  )}

                  <div className="segment-actions">
                    {segment.status === SegmentStatus.FAILED && onRetrySegment && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetrySegment(segment.id);
                        }}
                        className="retry-button"
                        title="Retry processing"
                      >
                        <RotateCw size={14} />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSegmentDelete(segment.id);
                      }}
                      disabled={segment.status === SegmentStatus.PROCESSING || 
                                segment.status === SegmentStatus.UPLOADING ||
                                segment.status === SegmentStatus.EXTRACTING}
                      className="delete-button"
                      title="Delete segment"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>

      {segments.length > 0 && (
        <div className="queue-footer">
          <div className="total-duration">
            Total duration: {formatDuration(segments.reduce((sum, s) => sum + s.duration, 0))}
          </div>
          <div className="queue-actions">
            <button
              onClick={() => {
                if (confirm('Are you sure you want to clear all segments?')) {
                  segments.forEach(segment => onSegmentDelete(segment.id));
                }
              }}
              disabled={queueStatus?.isProcessing}
              className="clear-queue-button"
            >
              Clear Queue
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SegmentQueue;