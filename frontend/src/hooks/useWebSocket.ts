import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ProcessingProgress, ExportProgress } from '../types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

interface WebSocketCallbacks {
  onProcessingStatus?: (data: ProcessingProgress) => void;
  onSegmentFailed?: (data: { segmentId: string; error: string }) => void;
  onQueueCompleted?: (data: { sessionId: string }) => void;
  onQueueFailed?: (data: { sessionId: string; error: string }) => void;
  onExportStarted?: (data: { sessionId: string; exportId: string }) => void;
  onExportProgress?: (data: ExportProgress) => void;
  onExportCompleted?: (data: { sessionId: string; exportId: string; downloadUrl: string }) => void;
  onExportFailed?: (data: { sessionId: string; exportId: string; error: string }) => void;
  onExportCancelled?: (data: { sessionId: string; exportId: string }) => void;
  onProcessingCancelled?: (data: { sessionId: string }) => void;
}

export const useWebSocket = (sessionId: string | null, callbacks: WebSocketCallbacks = {}) => {
  const socketRef = useRef<Socket | null>(null);
  const callbacksRef = useRef(callbacks);
  
  // Update callbacks ref when callbacks change
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const connect = useCallback(() => {
    if (!sessionId) return;

    if (socketRef.current?.connected) {
      return;
    }

    console.log('Connecting to WebSocket...');
    
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('Connected to WebSocket');
      socket.emit('join-session', sessionId);
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected from WebSocket:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    // Processing events
    socket.on('processing-status', (data: ProcessingProgress) => {
      callbacksRef.current.onProcessingStatus?.(data);
    });

    socket.on('segment-failed', (data: { segmentId: string; error: string }) => {
      callbacksRef.current.onSegmentFailed?.(data);
    });

    socket.on('queue-completed', (data: { sessionId: string }) => {
      callbacksRef.current.onQueueCompleted?.(data);
    });

    socket.on('queue-failed', (data: { sessionId: string; error: string }) => {
      callbacksRef.current.onQueueFailed?.(data);
    });

    socket.on('processing-cancelled', (data: { sessionId: string }) => {
      callbacksRef.current.onProcessingCancelled?.(data);
    });

    // Export events
    socket.on('export-started', (data: { sessionId: string; exportId: string }) => {
      callbacksRef.current.onExportStarted?.(data);
    });

    socket.on('export-progress', (data: ExportProgress) => {
      callbacksRef.current.onExportProgress?.(data);
    });

    socket.on('export-completed', (data: { sessionId: string; exportId: string; downloadUrl: string }) => {
      callbacksRef.current.onExportCompleted?.(data);
    });

    socket.on('export-failed', (data: { sessionId: string; exportId: string; error: string }) => {
      callbacksRef.current.onExportFailed?.(data);
    });

    socket.on('export-cancelled', (data: { sessionId: string; exportId: string }) => {
      callbacksRef.current.onExportCancelled?.(data);
    });

    socketRef.current = socket;
  }, [sessionId]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      if (sessionId) {
        socketRef.current.emit('leave-session', sessionId);
      }
      socketRef.current.disconnect();
      socketRef.current = null;
      console.log('Disconnected from WebSocket');
    }
  }, [sessionId]);

  const approveSegment = useCallback((segmentId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('approve-segment', { segmentId });
    }
  }, []);

  const rejectSegment = useCallback((segmentId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('reject-segment', { segmentId });
    }
  }, []);

  const startProcessing = useCallback((segmentIds: string[]) => {
    if (socketRef.current?.connected && sessionId) {
      socketRef.current.emit('start-processing', { sessionId, segmentIds });
    }
  }, [sessionId]);

  const cancelProcessing = useCallback((segmentId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('cancel-processing', { segmentId });
    }
  }, []);

  useEffect(() => {
    if (sessionId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [sessionId, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected: socketRef.current?.connected || false,
    connect,
    disconnect,
    approveSegment,
    rejectSegment,
    startProcessing,
    cancelProcessing,
  };
};