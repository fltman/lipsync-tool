import React, { useState } from 'react';
import { Download, Settings, CheckCircle, XCircle, Loader, Play } from 'lucide-react';
import { Segment, ApprovalStatus, ExportProgress } from '../types';

interface ExportPanelProps {
  segments: Segment[];
  exportProgress: ExportProgress | null;
  onExport: () => void;
}

const ExportPanel: React.FC<ExportPanelProps> = ({
  segments,
  exportProgress,
  onExport,
}) => {
  const [exportFormat, setExportFormat] = useState('mp4');
  const [exportQuality, setExportQuality] = useState('high');

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${minutes}:${secs.padStart(4, '0')}`;
  };

  const approvedSegments = segments.filter(s => s.approvalStatus === ApprovalStatus.APPROVED);
  const rejectedSegments = segments.filter(s => s.approvalStatus === ApprovalStatus.REJECTED);
  const pendingSegments = segments.filter(s => s.approvalStatus === ApprovalStatus.PENDING);
  
  const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);
  const processedDuration = approvedSegments.reduce((sum, s) => sum + s.duration, 0);
  
  const canExport = pendingSegments.length === 0 && segments.length > 0;
  const isExporting = exportProgress !== null;

  return (
    <div className="export-panel">
      <div className="export-header">
        <h3>Export Final Video</h3>
        <p>Create your final video with the processed segments</p>
      </div>

      <div className="export-content">
        <div className="export-summary">
          <h4>Export Summary</h4>
          
          <div className="summary-stats">
            <div className="stat-card">
              <div className="stat-icon approved">
                <CheckCircle size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{approvedSegments.length}</div>
                <div className="stat-label">Segments to Replace</div>
                <div className="stat-detail">{formatDuration(processedDuration)} total</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon rejected">
                <XCircle size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{rejectedSegments.length}</div>
                <div className="stat-label">Original Segments</div>
                <div className="stat-detail">
                  {formatDuration(rejectedSegments.reduce((sum, s) => sum + s.duration, 0))} total
                </div>
              </div>
            </div>
          </div>

          {pendingSegments.length > 0 && (
            <div className="pending-warning">
              <div className="warning-icon">⚠️</div>
              <div className="warning-text">
                <strong>{pendingSegments.length} segments</strong> still need review before export.
                <br />
                Please review all segments in the Review tab first.
              </div>
            </div>
          )}
        </div>

        <div className="export-settings">
          <h4>Export Settings</h4>
          
          <div className="setting-group">
            <label htmlFor="export-format">Format</label>
            <select
              id="export-format"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              disabled={isExporting}
            >
              <option value="mp4">MP4 (Recommended)</option>
              <option value="mov">MOV</option>
              <option value="avi">AVI</option>
            </select>
          </div>

          <div className="setting-group">
            <label htmlFor="export-quality">Quality</label>
            <select
              id="export-quality"
              value={exportQuality}
              onChange={(e) => setExportQuality(e.target.value)}
              disabled={isExporting}
            >
              <option value="high">High Quality</option>
              <option value="medium">Medium Quality</option>
              <option value="low">Low Quality (Fast)</option>
            </select>
          </div>
        </div>

        <div className="segment-preview">
          <h4>Export Preview</h4>
          <div className="timeline-preview">
            {segments
              .sort((a, b) => a.startTime - b.startTime)
              .map((segment, index) => (
                <div key={segment.id} className="preview-segment">
                  <div className="segment-number">#{index + 1}</div>
                  <div className="segment-info">
                    <div className="time-range">
                      {formatTime(segment.startTime)} → {formatTime(segment.endTime)}
                    </div>
                    <div className={`segment-type ${segment.approvalStatus}`}>
                      {segment.approvalStatus === ApprovalStatus.APPROVED ? 'Processed' : 'Original'}
                    </div>
                  </div>
                  <div className={`approval-indicator ${segment.approvalStatus}`}>
                    {segment.approvalStatus === ApprovalStatus.APPROVED ? (
                      <CheckCircle size={16} />
                    ) : (
                      <XCircle size={16} />
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {isExporting && (
          <div className="export-progress">
            <div className="progress-header">
              <Loader size={24} className="animate-spin" />
              <h4>Exporting Video...</h4>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${exportProgress?.progress || 0}%` }}
              />
            </div>
            <div className="progress-text">
              {exportProgress?.progress || 0}% complete
            </div>
            <p className="progress-note">
              Please don't close this window while export is in progress.
              This may take several minutes depending on video length and quality settings.
            </p>
          </div>
        )}

        <div className="export-actions">
          <button
            onClick={onExport}
            disabled={!canExport || isExporting}
            className="export-button"
          >
            {isExporting ? (
              <>
                <Loader size={20} className="animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={20} />
                Export Video
              </>
            )}
          </button>
          
          {canExport && !isExporting && (
            <div className="export-info">
              <p>
                Ready to export! Your final video will include {approvedSegments.length} processed segments
                and {rejectedSegments.length} original segments.
              </p>
            </div>
          )}
        </div>

        <div className="export-tips">
          <h5>Export Tips</h5>
          <ul>
            <li><strong>High Quality:</strong> Best results but larger file size and longer processing time</li>
            <li><strong>Medium Quality:</strong> Good balance of quality and file size</li>
            <li><strong>Low Quality:</strong> Faster export with smaller file size</li>
            <li>The export process preserves the original video quality for non-processed segments</li>
            <li>Your download will start automatically when export is complete</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ExportPanel;