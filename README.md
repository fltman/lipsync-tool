# Lipsync Tool

A web-based application for processing video segments with AI-powered lip synchronization using the KlingAI API.

## Features

- 🎬 **Video Upload & Analysis**: Upload videos in multiple formats (MP4, MOV, AVI, MKV, WebM)
- ✂️ **Frame-Accurate Segment Selection**: Select precise video segments using timeline controls
- 🤖 **AI Lip Synchronization**: Process segments with KlingAI's advanced lipsync technology
- ⚡ **Parallel Processing**: Process up to 4 segments simultaneously for faster workflow
- 🔄 **Retry Failed Segments**: Easily retry segments that fail processing with dedicated retry button
- 💾 **Session Persistence**: Your work is automatically saved and restored between browser sessions
- 🔍 **Review & Approval System**: Compare original vs processed segments side-by-side
- 📤 **Smart Export**: Combine approved segments into final output video
- 🔄 **Real-time Updates**: WebSocket-powered progress tracking
- 🎯 **Enhanced Keyboard Shortcuts**: 
  - `Space`: Play/Pause
  - `I`: Mark in-point
  - `O`: Mark out-point  
  - `←/→`: Seek 0.1s (hold Shift for 1s steps)

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Video Processing**: FFmpeg integration
- **AI Service**: KlingAI Lipsync API
- **Real-time Communication**: Socket.IO

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- FFmpeg installed and accessible in PATH
- KlingAI API credentials (included in project)

### Installation & Setup

1. **Clone and navigate to project**:
   ```bash
   cd lipsynctool
   ```

2. **Start Backend Server**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   Server will start at http://localhost:3001

3. **Start Frontend (in new terminal)**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Application will be available at http://localhost:5173

### First-Time Setup

1. Ensure FFmpeg is installed:
   ```bash
   # macOS
   brew install ffmpeg
   
   # Linux
   apt-get install ffmpeg
   
   # Windows
   # Download from https://ffmpeg.org/download.html
   ```

2. Update FFmpeg path in `backend/.env` if needed:
   ```
   FFMPEG_PATH=/usr/local/bin/ffmpeg
   ```

## Usage Guide

### 1. Upload Video
- Drag and drop a video file or click to browse
- Supported formats: MP4, MOV, AVI, MKV, WebM
- Maximum file size: 2GB

### 2. Create Segments
- Use the timeline to navigate through your video
- **Keyboard shortcuts**:
  - `Space`: Play/Pause
  - `I`: Mark in-point
  - `O`: Mark out-point  
  - `←/→`: Seek backward/forward
- Click "Add Segment" to queue selected portion

### 3. Process Queue
- Review your segments in the queue panel
- Click "Process Queue" to start AI processing
- Monitor real-time progress for each segment

### 4. Review Results
- Switch to "Review" tab when processing completes
- Compare original vs processed segments
- Use side-by-side comparison mode
- Approve or reject each segment

### 5. Export Final Video
- Move to "Export" tab after reviewing all segments
- Choose export settings (format, quality)
- Click "Export Video" to generate final result
- Download starts automatically when complete

## Development

### Project Structure
```
lipsynctool/
├── backend/                 # Express server
│   ├── src/
│   │   ├── api/            # REST API routes
│   │   ├── services/       # Core services (FFmpeg, KlingAI)
│   │   ├── types/          # TypeScript interfaces
│   │   └── index.ts        # Server entry point
│   ├── temp/               # Temporary file storage
│   └── package.json
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API client
│   │   └── types/          # TypeScript interfaces
│   └── package.json
└── CLAUDE.md              # Development guidance
```

### Key Components

**Backend Services:**
- `FFmpegService`: Video processing and manipulation
- `KlingAIService`: AI API integration with retry logic
- `SessionManager`: State management for video sessions
- WebSocket server for real-time updates

**Frontend Components:**
- `VideoPlayer`: Custom video player with timeline
- `SegmentQueue`: Queue management interface
- `ReviewPanel`: Side-by-side comparison viewer
- `ExportPanel`: Final video export controls

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload video file |
| GET | `/api/upload/session/:id/video` | Stream video |
| POST | `/api/segments` | Create new segment |
| GET | `/api/segments/session/:id` | Get session segments |
| DELETE | `/api/segments/:id` | Delete segment |
| POST | `/api/queue/process` | Start processing |
| POST | `/api/export` | Start export |
| GET | `/api/export/download/:id` | Download result |

### Build & Deploy

**Development**:
```bash
# Backend
cd backend && npm run dev

# Frontend  
cd frontend && npm run dev
```

**Production**:
```bash
# Backend
cd backend && npm run build && npm start

# Frontend
cd frontend && npm run build
# Serve dist/ folder with nginx/apache
```

## Configuration

### Environment Variables

**Backend (`backend/.env`)**:
```env
PORT=3001
NODE_ENV=development
KLINGAI_ACCESS_KEY=AB8n8DLe8PraGM3M9GYYePag93ybnrmL
KLINGAI_SECRET_KEY=Hg8EEfBHkGdPgYFGYbtJArGFrHgLgKrB
KLINGAI_API_ENDPOINT=https://api.klingai.com
TEMP_STORAGE_PATH=./temp
MAX_FILE_SIZE=2147483648
SESSION_TIMEOUT=3600000
FFMPEG_PATH=/usr/local/bin/ffmpeg
FFPROBE_PATH=/usr/local/bin/ffprobe
```

**Frontend (`frontend/.env`)**:
```env
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

## Troubleshooting

### Common Issues

**FFmpeg Not Found**:
- Install FFmpeg: `brew install ffmpeg` (macOS)
- Update `FFMPEG_PATH` in backend `.env`

**CORS Issues**:
- Check backend CORS configuration
- Verify frontend URL in backend settings

**Large File Upload Fails**:
- Check `MAX_FILE_SIZE` setting
- Ensure sufficient disk space in temp directory

**API Rate Limiting**:
- KlingAI API has usage limits
- Processing automatically handles retries
- Check API credentials if persistent failures

**WebSocket Connection Issues**:
- Verify both servers are running
- Check firewall settings
- Ensure ports 3001 and 5173 are available

### Performance Tips

- **Video Quality**: Higher quality = longer processing time
- **Segment Length**: Keep segments under 60 seconds for optimal results
- **Parallel Processing**: Up to 4 segments process simultaneously for faster workflow
- **Retry Mechanism**: Failed segments can be retried individually without recreating
- **Session Persistence**: Your progress is automatically saved and restored
- **Precision Seeking**: Use arrow keys for precise 0.1s navigation (Shift for 1s steps)
- **Disk Space**: Ensure adequate space (3x video file size recommended)

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push branch: `git push origin feature/new-feature`
5. Submit pull request

## License

This project is for educational purposes. KlingAI API usage subject to their terms of service.

## Support

For issues and questions:
1. Check troubleshooting section above
2. Review server logs for error details
3. Ensure all dependencies are correctly installed
4. Verify API credentials and network connectivity