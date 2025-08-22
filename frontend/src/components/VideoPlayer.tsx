import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward } from 'lucide-react';
import { Segment } from '../types';
import { apiService } from '../services/api';

interface VideoPlayerProps {
  sessionId: string;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  segments: Segment[];
  onSegmentCreate: (startTime: number, endTime: number) => void;
  selectedSegment: Segment | null;
  onSegmentSelect: (segment: Segment | null) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  sessionId,
  duration,
  currentTime,
  isPlaying,
  onTimeUpdate,
  onPlayStateChange,
  segments,
  onSegmentCreate,
  selectedSegment,
  onSegmentSelect,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [markIn, setMarkIn] = useState<number | null>(null);
  const [markOut, setMarkOut] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const videoUrl = apiService.getVideoStreamUrl(sessionId);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!isDragging) {
        onTimeUpdate(video.currentTime);
      }
    };

    const handlePlay = () => onPlayStateChange(true);
    const handlePause = () => onPlayStateChange(false);
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [onTimeUpdate, onPlayStateChange, isDragging]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Math.abs(video.currentTime - currentTime) > 0.1) {
      video.currentTime = currentTime;
    }

    if (isPlaying && video.paused) {
      video.play().catch(console.error);
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [currentTime, isPlaying]);

  const handlePlayPause = useCallback(() => {
    onPlayStateChange(!isPlaying);
  }, [isPlaying, onPlayStateChange]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    const video = videoRef.current;
    if (video) {
      video.volume = newVolume;
      setVolume(newVolume);
    }
  }, []);

  const handleMute = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = !video.muted;
      setIsMuted(video.muted);
    }
  }, []);

  const handleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!document.fullscreenElement) {
      video.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }, []);

  const handleTimelineClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const timeline = timelineRef.current;
    if (!timeline) return;

    const rect = timeline.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const newTime = (x / rect.width) * duration;
    onTimeUpdate(newTime);
  }, [duration, onTimeUpdate]);

  const handleTimelineDrag = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.buttons !== 1) return;
    setIsDragging(true);
    handleTimelineClick(event);
  }, [handleTimelineClick]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.key.toLowerCase()) {
      case ' ':
        event.preventDefault();
        handlePlayPause();
        break;
      case 'i':
        event.preventDefault();
        setMarkIn(currentTime);
        break;
      case 'o':
        event.preventDefault();
        setMarkOut(currentTime);
        break;
      case 'arrowleft':
        event.preventDefault();
        // Use shift for larger steps (1s), normal for smaller steps (0.1s)
        const leftStep = event.shiftKey ? 1 : 0.1;
        onTimeUpdate(Math.max(0, currentTime - leftStep));
        break;
      case 'arrowright':
        event.preventDefault();
        // Use shift for larger steps (1s), normal for smaller steps (0.1s)
        const rightStep = event.shiftKey ? 1 : 0.1;
        onTimeUpdate(Math.min(duration, currentTime + rightStep));
        break;
    }
  }, [currentTime, duration, handlePlayPause, onTimeUpdate]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleKeyDown, handleMouseUp]);

  const handleCreateSegment = useCallback(() => {
    if (markIn !== null && markOut !== null && markIn < markOut) {
      onSegmentCreate(markIn, markOut);
      setMarkIn(null);
      setMarkOut(null);
    }
  }, [markIn, markOut, onSegmentCreate]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const getTimelinePosition = (time: number): number => {
    return (time / duration) * 100;
  };

  return (
    <div className="video-player">
      <div className="video-container">
        <video
          ref={videoRef}
          src={videoUrl}
          className="video-element"
          preload="metadata"
        />
        
        <div className="video-overlay">
          <div className="playback-controls">
            <button onClick={handlePlayPause} className="play-button">
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
          </div>
        </div>
      </div>

      <div className="timeline-container">
        <div className="time-display">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
        
        <div
          ref={timelineRef}
          className="timeline"
          onClick={handleTimelineClick}
          onMouseMove={handleTimelineDrag}
        >
          <div className="timeline-background"></div>
          
          {/* Segments */}
          {segments.map((segment) => (
            <div
              key={segment.id}
              className={`timeline-segment ${selectedSegment?.id === segment.id ? 'selected' : ''} status-${segment.status}`}
              style={{
                left: `${getTimelinePosition(segment.startTime)}%`,
                width: `${getTimelinePosition(segment.duration)}%`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSegmentSelect(segment);
              }}
              title={`${formatTime(segment.startTime)} - ${formatTime(segment.endTime)} (${segment.status})`}
            />
          ))}

          {/* Mark In */}
          {markIn !== null && (
            <div
              className="timeline-mark mark-in"
              style={{ left: `${getTimelinePosition(markIn)}%` }}
            />
          )}

          {/* Mark Out */}
          {markOut !== null && (
            <div
              className="timeline-mark mark-out"
              style={{ left: `${getTimelinePosition(markOut)}%` }}
            />
          )}

          {/* Selection Range */}
          {markIn !== null && markOut !== null && (
            <div
              className="timeline-selection"
              style={{
                left: `${getTimelinePosition(markIn)}%`,
                width: `${getTimelinePosition(markOut - markIn)}%`,
              }}
            />
          )}

          {/* Playhead */}
          <div
            className="timeline-playhead"
            style={{ left: `${getTimelinePosition(currentTime)}%` }}
          />
        </div>
      </div>

      <div className="player-controls">
        <div className="controls-left">
          <button onClick={handlePlayPause} className="control-button">
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          
          <button 
            onClick={() => onTimeUpdate(Math.max(0, currentTime - 10))} 
            className="control-button"
          >
            <SkipBack size={20} />
          </button>
          
          <button 
            onClick={() => onTimeUpdate(Math.min(duration, currentTime + 10))} 
            className="control-button"
          >
            <SkipForward size={20} />
          </button>

          <div className="volume-control">
            <button onClick={handleMute} className="control-button">
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="volume-slider"
            />
          </div>
        </div>

        <div className="controls-center">
          <div className="mark-controls">
            <button 
              onClick={() => setMarkIn(currentTime)}
              className={`mark-button ${markIn !== null ? 'active' : ''}`}
            >
              Mark In (I)
            </button>
            <button 
              onClick={() => setMarkOut(currentTime)}
              className={`mark-button ${markOut !== null ? 'active' : ''}`}
            >
              Mark Out (O)
            </button>
            <button 
              onClick={handleCreateSegment}
              disabled={markIn === null || markOut === null || markIn >= markOut}
              className="create-segment-button"
            >
              Add Segment
            </button>
          </div>
        </div>

        <div className="controls-right">
          <button onClick={handleFullscreen} className="control-button">
            <Maximize size={20} />
          </button>
        </div>
      </div>

      <div className="keyboard-shortcuts">
        <small>
          <strong>Shortcuts:</strong> Space = Play/Pause | I = Mark In | O = Mark Out | ← → = Seek
        </small>
      </div>
    </div>
  );
};

export default VideoPlayer;