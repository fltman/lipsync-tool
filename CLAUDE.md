# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Lipsync Tool development project - a web-based application with local backend for processing video segments through the KlingAI lipsync API. The tool allows users to select portions of uploaded videos, process them for lip synchronization, review results, and export final videos with approved segments replaced.

## Project Status

**Current State**: Specification phase - the project has a detailed specification (`lipsync-tool-spec.md`) but no implementation yet.

## Architecture Overview

The application follows a client-server architecture:

- **Frontend**: Web interface for video upload, segment selection, and review
- **Backend**: Local server handling video processing and API integration
- **Processing Engine**: FFmpeg for video manipulation
- **External API**: KlingAI lipsync service (documentation: https://app.klingai.com/global/dev/document-api/apiReference/model/videoTolip)

## Implementation Approach

### Backend Technology Stack Options

#### Option 1: Node.js/Express (Recommended)
```bash
# Initialize project
npm init -y
npm install express multer socket.io fluent-ffmpeg axios dotenv cors
npm install -D @types/node @types/express typescript nodemon

# Development
npm run dev    # Start development server with hot reload
npm run build  # Build TypeScript
npm start      # Start production server

# Testing
npm test       # Run tests
npm run test:watch  # Run tests in watch mode
```

#### Option 2: Python/FastAPI
```bash
# Setup virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn python-multipart websockets httpx python-dotenv ffmpeg-python aiofiles

# Development
uvicorn main:app --reload --port 3001  # Start development server

# Testing
pytest tests/  # Run tests
pytest -v      # Verbose test output
```

### Frontend Technology Stack
```bash
# Using Vite + React + TypeScript
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install axios socket.io-client @tanstack/react-query video.js

# Development
npm run dev    # Start development server
npm run build  # Build for production
npm run preview  # Preview production build
```

## Project Structure

```
lipsynctool/
├── backend/                  # Backend server
│   ├── src/
│   │   ├── api/             # API endpoints
│   │   │   ├── upload.js    # Video upload handling
│   │   │   ├── segments.js  # Segment management
│   │   │   ├── queue.js     # Queue operations
│   │   │   └── export.js    # Export functionality
│   │   ├── services/
│   │   │   ├── ffmpeg.js    # FFmpeg operations
│   │   │   ├── klingai.js   # KlingAI API integration
│   │   │   └── session.js   # Session management
│   │   ├── utils/
│   │   │   └── storage.js   # File storage utilities
│   │   └── index.js         # Server entry point
│   ├── temp/                # Temporary file storage
│   └── package.json
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── VideoPlayer.tsx
│   │   │   ├── Timeline.tsx
│   │   │   ├── SegmentQueue.tsx
│   │   │   └── ReviewPanel.tsx
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts
│   │   ├── services/
│   │   │   └── api.ts
│   │   └── App.tsx
│   └── package.json
└── lipsync-tool-spec.md     # Project specification
```

## Key Implementation Tasks

### Phase 1: Basic Infrastructure
1. Set up backend server with file upload capability
2. Implement FFmpeg integration for video extraction
3. Create frontend with video player
4. Establish WebSocket connection for real-time updates

### Phase 2: Core Functionality
1. Implement segment selection interface
2. Create queue management system
3. Integrate KlingAI API
4. Build processing pipeline

### Phase 3: Review and Export
1. Develop review/approval interface
2. Implement video splicing for final export
3. Add progress tracking
4. Handle error recovery

## Environment Configuration

Create `.env` file in backend directory:
```env
# Server Configuration
PORT=3001
NODE_ENV=development

# KlingAI API Configuration
KLINGAI_ACCESS_KEY=xxx
KLINGAI_SECRET_KEY=xxx
KLINGAI_API_ENDPOINT=https://api.klingai.com

# Storage Configuration
TEMP_STORAGE_PATH=./temp
MAX_FILE_SIZE=2147483648  # 2GB in bytes
SESSION_TIMEOUT=3600000    # 1 hour in milliseconds

# FFmpeg Configuration
FFMPEG_PATH=/usr/local/bin/ffmpeg  # Update based on system
```

**Important Security Note**: Never commit the `.env` file to version control. Add it to `.gitignore` immediately.

## FFmpeg Commands Reference

```bash
# Extract video segment
ffmpeg -i input.mp4 -ss 00:01:30 -t 00:00:10 -c copy segment.mp4

# Extract audio from segment
ffmpeg -i segment.mp4 -vn -acodec pcm_s16le -ar 44100 -ac 2 audio.wav

# Concatenate videos (with list file)
ffmpeg -f concat -safe 0 -i list.txt -c copy output.mp4

# Check video metadata
ffprobe -v quiet -print_format json -show_format -show_streams input.mp4
```

## API Integration Notes

### KlingAI Lipsync API
- Review full documentation at: https://app.klingai.com/global/dev/document-api/apiReference/model/videoTolip
- Implement proper authentication with API keys
- Handle rate limiting and quotas
- Add retry logic with exponential backoff
- Log all API interactions for debugging

### WebSocket Events
```javascript
// Server to Client
socket.emit('processing-status', { segmentId, status, progress })
socket.emit('queue-update', { queue })
socket.emit('error', { message, segmentId })

// Client to Server
socket.on('start-processing', { queueId })
socket.on('cancel-processing', { segmentId })
socket.on('approve-segment', { segmentId })
```

## Testing Approach

### Backend Testing
```javascript
// Test file upload limits
// Test FFmpeg operations with various formats
// Mock KlingAI API responses
// Test session management
// Verify error handling
```

### Frontend Testing
```javascript
// Test video player controls
// Test segment selection accuracy
// Test queue management
// Test WebSocket reconnection
// Test responsive design
```

## Development Workflow

1. **Start Backend Server**
   ```bash
   cd backend
   npm run dev  # or: python -m uvicorn main:app --reload
   ```

2. **Start Frontend Development Server**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

## Common Issues and Solutions

### FFmpeg Not Found
- Install FFmpeg: `brew install ffmpeg` (macOS) or `apt-get install ffmpeg` (Linux)
- Update FFMPEG_PATH in .env file

### CORS Issues
- Ensure backend CORS middleware is configured for frontend origin
- Check WebSocket CORS configuration

### Large File Handling
- Configure multer/fastapi for large file uploads
- Implement chunked upload for very large files
- Monitor temp directory disk space

### API Rate Limiting
- Implement queue throttling
- Add delay between API calls
- Cache processed results when possible

## Performance Optimization

- Use streaming for video playback instead of loading entire file
- Implement lazy loading for queue items
- Use virtual scrolling for long queues
- Optimize FFmpeg commands for speed vs quality trade-offs
- Implement concurrent processing where API allows

## Security Considerations

- Store API keys only on backend
- Validate all file uploads (type, size, content)
- Implement session isolation
- Sanitize file paths to prevent directory traversal
- Add rate limiting to prevent abuse
- Implement automatic cleanup of old temporary files