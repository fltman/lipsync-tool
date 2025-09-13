# Timeout Improvements for Longer Video Clips

## Problem
The previous timeout of 5 minutes was too short for longer video clips, causing processing failures with messages like:
```
Task 793782858677616733 timed out after 300000ms
```

## Solution Implemented

### 1. **Dynamic Timeout Calculation**
- **Base timeout**: 20 minutes (increased from 5 minutes)
- **Duration-based scaling**: Timeout now scales with video length
- **Default rate**: 3 minutes of timeout per second of video
- **Minimum**: Always at least 20 minutes, even for very short clips

### 2. **Configurable Timeout Multiplier**
Added to `.env`:
```env
KLINGAI_TIMEOUT_MULTIPLIER=180  # Seconds of timeout per second of video
```

**Examples:**
- 10-second clip: 20 minutes timeout (base minimum)
- 30-second clip: 90 minutes timeout (30 × 3 minutes)  
- 60-second clip: 180 minutes timeout (60 × 3 minutes)

### 3. **Better Progress Logging**
- Shows elapsed time during processing
- Logs when tasks are still processing every 10 seconds
- Clearer status messages for long-running tasks

### 4. **Improved Polling Intervals**
- Processing tasks: Check every 10 seconds (was 5 seconds)
- Submitted tasks: Check every 5 seconds  
- Reduces API calls while maintaining responsiveness

## Configuration Options

### Adjust Timeout Multiplier
To change how much timeout is allocated per second of video:

```env
# Conservative (5 minutes per second)
KLINGAI_TIMEOUT_MULTIPLIER=300

# Aggressive (1 minute per second - may timeout on complex clips)
KLINGAI_TIMEOUT_MULTIPLIER=60

# Default (3 minutes per second)
KLINGAI_TIMEOUT_MULTIPLIER=180
```

### For Very Long Clips (2+ minutes)
If processing 2+ minute clips regularly, consider:
```env
KLINGAI_TIMEOUT_MULTIPLIER=240  # 4 minutes per second
```

## Monitoring Long Processing Jobs

The backend now logs progress for long-running jobs:
```
Task 793782858677616733 still processing... (45s elapsed)
Task 793782858677616733 still processing... (55s elapsed)
Using timeout of 1800s for estimated 30s video duration
```

Watch your backend logs to monitor progress on longer clips.

## Fallback Behavior

If a clip still times out:
1. Cloud storage files are automatically cleaned up
2. Error is reported to frontend
3. Other segments in the queue continue processing
4. You can retry the failed segment

## Testing

Recommended test cases:
- ✅ Short clips (5-10 seconds) - should use 20-minute base timeout
- ✅ Medium clips (30-60 seconds) - should scale appropriately  
- ✅ Long clips (2+ minutes) - should get very generous timeouts
- ✅ Multiple clips in queue - should not affect each other's timeouts

The system is now much more robust for processing longer video segments!