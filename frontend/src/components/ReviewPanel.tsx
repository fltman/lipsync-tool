import React, { useState } from 'react';
import { Check, X, Play, Pause, SkipBack, SkipForward, Eye } from 'lucide-react';
import { Segment, ApprovalStatus } from '../types';
import { apiService } from '../services/api';

interface ReviewPanelProps {
  segments: Segment[];
  onSegmentApproval: (segmentId: string, approved: boolean) => void;
  selectedSegment: Segment | null;
  onSegmentSelect: (segment: Segment) => void;
}

const ReviewPanel: React.FC<ReviewPanelProps> = ({
  segments,
  onSegmentApproval,
  selectedSegment,
  onSegmentSelect,
}) => {
  const [currentVideoType, setCurrentVideoType] = useState<'original' | 'processed'>('processed');
  const [isPlaying, setIsPlaying] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${minutes}:${secs.padStart(4, '0')}`;
  };

  const formatDuration = (seconds: number): string => {
    return `${seconds.toFixed(1)}s`;
  };

  const getApprovalStatusColor = (status: ApprovalStatus): string => {
    switch (status) {
      case ApprovalStatus.APPROVED:
        return 'text-green-600 bg-green-100';
      case ApprovalStatus.REJECTED:
        return 'text-red-600 bg-red-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  const getApprovalStatusText = (status: ApprovalStatus): string => {
    switch (status) {
      case ApprovalStatus.APPROVED:
        return 'Approved';
      case ApprovalStatus.REJECTED:
        return 'Rejected';
      default:
        return 'Pending Review';
    }
  };

  const pendingSegments = segments.filter(s => s.approvalStatus === ApprovalStatus.PENDING);
  const approvedSegments = segments.filter(s => s.approvalStatus === ApprovalStatus.APPROVED);
  const rejectedSegments = segments.filter(s => s.approvalStatus === ApprovalStatus.REJECTED);

  const currentSegment = selectedSegment || segments[0];

  return (
    <div className="review-panel">
      <div className="review-header">
        <h3>Review Processed Segments</h3>
        <div className="review-stats">
          <span className="stat">
            <span className="stat-value">{pendingSegments.length}</span>
            <span className="stat-label">Pending</span>
          </span>
          <span className="stat approved">
            <span className="stat-value">{approvedSegments.length}</span>
            <span className="stat-label">Approved</span>
          </span>
          <span className="stat rejected">
            <span className="stat-value">{rejectedSegments.length}</span>
            <span className="stat-label">Rejected</span>
          </span>
        </div>
      </div>

      <div className="review-content">
        <div className="segment-list-panel">
          <div className="segment-list">
            {segments
              .sort((a, b) => a.startTime - b.startTime)
              .map((segment, index) => (
                <div
                  key={segment.id}
                  className={`review-segment-item ${
                    currentSegment?.id === segment.id ? 'selected' : ''
                  } approval-${segment.approvalStatus}`}
                  onClick={() => onSegmentSelect(segment)}
                >
                  <div className="segment-number">#{index + 1}</div>
                  
                  <div className="segment-info">
                    <div className="time-range">
                      {formatTime(segment.startTime)} → {formatTime(segment.endTime)}
                    </div>
                    <div className="duration">
                      {formatDuration(segment.duration)}
                    </div>
                  </div>

                  <div className={`approval-status ${getApprovalStatusColor(segment.approvalStatus)}`}>
                    {getApprovalStatusText(segment.approvalStatus)}
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="video-preview-panel">
          {currentSegment ? (
            <>
              <div className="preview-controls">
                <div className="video-type-selector">
                  <button
                    className={`type-button ${currentVideoType === 'original' ? 'active' : ''}`}
                    onClick={() => setCurrentVideoType('original')}
                  >
                    Original
                  </button>
                  <button
                    className={`type-button ${currentVideoType === 'processed' ? 'active' : ''}`}
                    onClick={() => setCurrentVideoType('processed')}
                  >
                    Processed
                  </button>
                  <button
                    className={`comparison-button ${showComparison ? 'active' : ''}`}
                    onClick={() => setShowComparison(!showComparison)}
                  >
                    <Eye size={16} />
                    Compare
                  </button>
                </div>
              </div>

              <div className={`video-container ${showComparison ? 'comparison-mode' : ''}`}>
                {showComparison ? (
                  <div className="video-comparison">
                    <div className="video-half">
                      <div className="video-label">Original</div>
                      <video
                        key={`${currentSegment.id}-original`}
                        src={apiService.getSegmentVideoUrl(currentSegment.id, 'original')}
                        controls
                        className="preview-video"
                        preload="metadata"
                      />
                    </div>
                    <div className="video-half">
                      <div className="video-label">Processed</div>
                      <video
                        key={`${currentSegment.id}-processed`}
                        src={apiService.getSegmentVideoUrl(currentSegment.id, 'processed')}
                        controls
                        className="preview-video"
                        preload="metadata"
                      />
                    </div>
                  </div>
                ) : (
                  <video
                    key={`${currentSegment.id}-${currentVideoType}`}
                    src={apiService.getSegmentVideoUrl(currentSegment.id, currentVideoType)}
                    controls
                    className="preview-video single"
                    preload="metadata"
                    autoPlay={isPlaying}
                  />
                )}
              </div>

              <div className="segment-details">
                <h4>Segment #{segments.indexOf(currentSegment) + 1}</h4>
                <div className="detail-row">
                  <span className="label">Time Range:</span>
                  <span className="value">
                    {formatTime(currentSegment.startTime)} → {formatTime(currentSegment.endTime)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">Duration:</span>
                  <span className="value">{formatDuration(currentSegment.duration)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Status:</span>
                  <span className={`value approval-badge ${getApprovalStatusColor(currentSegment.approvalStatus)}`}>
                    {getApprovalStatusText(currentSegment.approvalStatus)}
                  </span>
                </div>
              </div>

              <div className="approval-controls">
                <button
                  onClick={() => onSegmentApproval(currentSegment.id, false)}
                  className="reject-button"
                  disabled={currentSegment.approvalStatus === ApprovalStatus.REJECTED}
                >
                  <X size={16} />
                  Reject
                  <small>Use original</small>
                </button>
                
                <button
                  onClick={() => onSegmentApproval(currentSegment.id, true)}
                  className="approve-button"
                  disabled={currentSegment.approvalStatus === ApprovalStatus.APPROVED}
                >
                  <Check size={16} />
                  Approve
                  <small>Use processed</small>
                </button>
              </div>

              <div className="navigation-controls">
                <button
                  onClick={() => {
                    const currentIndex = segments.indexOf(currentSegment);
                    if (currentIndex > 0) {
                      onSegmentSelect(segments[currentIndex - 1]);
                    }
                  }}
                  disabled={segments.indexOf(currentSegment) === 0}
                  className="nav-button"
                >
                  <SkipBack size={16} />
                  Previous
                </button>
                
                <span className="segment-counter">
                  {segments.indexOf(currentSegment) + 1} of {segments.length}
                </span>
                
                <button
                  onClick={() => {
                    const currentIndex = segments.indexOf(currentSegment);
                    if (currentIndex < segments.length - 1) {
                      onSegmentSelect(segments[currentIndex + 1]);
                    }
                  }}
                  disabled={segments.indexOf(currentSegment) === segments.length - 1}
                  className="nav-button"
                >
                  Next
                  <SkipForward size={16} />
                </button>
              </div>
            </>
          ) : (
            <div className="no-segment-selected">
              <p>Select a segment from the list to review</p>
            </div>
          )}
        </div>
      </div>

      {pendingSegments.length === 0 && segments.length > 0 && (
        <div className="review-complete">
          <div className="complete-message">
            <Check size={24} className="text-green-500" />
            <h4>Review Complete!</h4>
            <p>
              All segments have been reviewed. 
              You can now proceed to export your final video.
            </p>
          </div>
          <div className="review-summary">
            <div className="summary-item approved">
              <span className="summary-count">{approvedSegments.length}</span>
              <span className="summary-label">segments will be replaced</span>
            </div>
            <div className="summary-item rejected">
              <span className="summary-count">{rejectedSegments.length}</span>
              <span className="summary-label">segments will use original</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewPanel;