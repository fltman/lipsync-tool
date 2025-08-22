import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UploadScreen from './components/UploadScreen';
import MainWorkspace from './components/MainWorkspace';
import './App.css';

const queryClient = new QueryClient();

export interface Session {
  id: string;
  metadata: {
    duration: number;
    resolution: { width: number; height: number };
    framerate: number;
    codec: string;
    format: string;
    size: number;
    filename: string;
  };
}

const STORAGE_KEY = 'lipsync_session';

function App() {
  const [session, setSession] = useState<Session | null>(() => {
    // Try to restore session from localStorage on initial load
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to restore session from localStorage:', error);
    }
    return null;
  });

  // Save session to localStorage whenever it changes
  useEffect(() => {
    if (session) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } catch (error) {
        console.error('Failed to save session to localStorage:', error);
      }
    } else {
      // Clear localStorage when session is null
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  const handleUploadSuccess = (sessionData: Session) => {
    setSession(sessionData);
  };

  const handleNewSession = () => {
    setSession(null);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app">
        <header className="app-header">
          <h1>Lipsync Tool</h1>
          <p>Process video segments with AI-powered lip synchronization</p>
        </header>
        
        <main className="app-main">
          {!session ? (
            <UploadScreen onUploadSuccess={handleUploadSuccess} />
          ) : (
            <MainWorkspace session={session} onNewSession={handleNewSession} />
          )}
        </main>
      </div>
    </QueryClientProvider>
  );
}

export default App;