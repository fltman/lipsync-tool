import React, { useState, useCallback } from 'react';
import { Upload, Film, AlertCircle } from 'lucide-react';
import { apiService } from '../services/api';
import { Session } from '../App';

interface UploadScreenProps {
  onUploadSuccess: (session: Session) => void;
}

const UploadScreen: React.FC<UploadScreenProps> = ({ onUploadSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    if (!file) return;

    console.log('Starting upload for file:', file.name, 'type:', file.type, 'size:', file.size);

    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
    // Also check for empty type and rely on file extension
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
    
    if (file.type && !allowedTypes.includes(file.type)) {
      console.warn('File type not in allowed list:', file.type);
      if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
        setError('Unsupported file type. Please upload MP4, MOV, AVI, MKV, or WebM files.');
        return;
      }
    }

    const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
    if (file.size > maxSize) {
      setError('File too large. Maximum size is 2GB.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      console.log('Uploading file to server...');
      const response = await apiService.uploadVideo(file, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percentCompleted);
        console.log('Upload progress:', percentCompleted + '%');
      });
      console.log('Upload successful:', response);
      
      const session: Session = {
        id: response.sessionId,
        metadata: response.metadata
      };

      onUploadSuccess(session);
    } catch (err: any) {
      console.error('Upload error:', err);
      console.error('Error response:', err.response);
      
      const errorMessage = err.response?.data?.details || 
                          err.response?.data?.error || 
                          err.message ||
                          'Failed to upload video. Please try again.';
      
      setError(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [onUploadSuccess]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  }, [handleUpload]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    
    const file = event.dataTransfer.files[0];
    if (file) {
      handleUpload(file);
    }
  }, [handleUpload]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="upload-screen">
      <div className="upload-container">
        <div className="upload-header">
          <Film size={48} className="upload-icon" />
          <h2>Upload Your Video</h2>
          <p>Select a video file to begin lip-sync processing</p>
        </div>

        {error && (
          <div className="error-message">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div
          className={`upload-dropzone ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {isUploading ? (
            <div className="upload-progress">
              <div className="progress-spinner"></div>
              <p>Uploading and analyzing video...</p>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <>
              <Upload size={64} className="dropzone-icon" />
              <p className="dropzone-text">
                Drag and drop your video file here, or{' '}
                <label htmlFor="file-input" className="file-input-label">
                  browse to select
                </label>
              </p>
              <input
                id="file-input"
                type="file"
                accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm"
                onChange={handleFileSelect}
                className="file-input"
              />
              <p className="dropzone-hint">
                Supported formats: MP4, MOV, AVI, MKV, WebM<br />
                Maximum size: 2GB
              </p>
            </>
          )}
        </div>

        <div className="upload-info">
          <h3>What happens next?</h3>
          <ul>
            <li>Your video will be uploaded and analyzed</li>
            <li>Select segments you want to process with lip-sync</li>
            <li>Review and approve the processed segments</li>
            <li>Export your final video with enhanced lip synchronization</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default UploadScreen;