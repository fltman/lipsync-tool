# Cloud Storage Setup Guide

This guide will help you set up cloud storage to replace ngrok for serving video files to KlingAI.

## Why Cloud Storage?

Previously, you needed ngrok to expose local files to KlingAI's API, which was:
- Clumsy and required manual ngrok setup
- Limited by ngrok's bandwidth and session limits
- Unreliable for production use

With cloud storage:
- Files are uploaded temporarily and served via signed URLs
- No need for ngrok or exposing your local machine
- Automatic cleanup after processing
- More reliable and scalable

## Option 1: CloudFlare R2 (Recommended)

CloudFlare R2 is the most cost-effective option with:
- **10 GB free storage** per month
- **10 million free requests** per month
- **No egress fees** (unlike AWS S3)
- S3-compatible API

### Setup Steps:

1. **Create CloudFlare Account**
   - Go to https://dash.cloudflare.com/sign-up
   - Sign up for a free account

2. **Enable R2**
   - Navigate to R2 in your CloudFlare dashboard
   - Click "Enable R2" (no credit card required for free tier)

3. **Create a Bucket**
   - Click "Create bucket"
   - Name it `lipsync-tool` (or your preferred name)
   - Select a location close to you

4. **Generate API Credentials**
   - Go to R2 > Manage R2 API Tokens
   - Click "Create API Token"
   - Give it a name (e.g., "Lipsync Tool")
   - Permissions: Select "Object Read & Write"
   - TTL: Leave as default or set as needed
   - Click "Create API Token"
   - **Save the credentials shown** (they won't be shown again!)

5. **Configure .env**
   ```env
   R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   R2_ACCESS_KEY_ID=<your-access-key-id>
   R2_SECRET_ACCESS_KEY=<your-secret-access-key>
   R2_BUCKET_NAME=lipsync-tool
   R2_REGION=auto
   ```

   The endpoint URL format is: `https://<account-id>.r2.cloudflarestorage.com`
   You can find your account ID in the R2 dashboard.

## Option 2: AWS S3

If you prefer AWS S3:

1. **Create AWS Account**
   - Go to https://aws.amazon.com
   - Sign up (requires credit card)

2. **Create S3 Bucket**
   - Go to S3 console
   - Click "Create bucket"
   - Name it uniquely (e.g., `lipsync-tool-yourname`)
   - Select a region close to you
   - Keep other settings as default

3. **Create IAM User**
   - Go to IAM console
   - Users > Add User
   - Give it a name (e.g., "lipsync-tool")
   - Select "Programmatic access"
   - Attach policy: "AmazonS3FullAccess" (or create a custom policy)
   - Save the Access Key ID and Secret Access Key

4. **Configure .env**
   ```env
   AWS_ACCESS_KEY_ID=<your-access-key-id>
   AWS_SECRET_ACCESS_KEY=<your-secret-access-key>
   S3_BUCKET_NAME=lipsync-tool-yourname
   AWS_REGION=us-east-1
   ```

## Option 3: Backblaze B2

A cost-effective alternative to AWS:

1. **Create Backblaze Account**
   - Go to https://www.backblaze.com/b2/
   - Sign up (10GB free)

2. **Create Bucket**
   - Create a new bucket
   - Set to "Private"

3. **Create Application Key**
   - Go to App Keys
   - Create new key with bucket access

4. **Configure .env**
   ```env
   S3_ENDPOINT=https://s3.us-west-000.backblazeb2.com
   AWS_ACCESS_KEY_ID=<your-key-id>
   AWS_SECRET_ACCESS_KEY=<your-application-key>
   S3_BUCKET_NAME=<your-bucket-name>
   AWS_REGION=us-west-000
   ```

## Testing Your Setup

1. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```

2. **Check logs for confirmation**
   You should see:
   ```
   Cloud storage configured: R2/S3-compatible in region auto
   ```

3. **Upload a video through the frontend**
   - The system will automatically use cloud storage
   - Check logs for "Files uploaded to cloud" messages

## Troubleshooting

### "Cloud storage not configured"
- Check your .env file has the correct credentials
- Ensure the bucket exists and is accessible
- Verify the endpoint URL is correct

### "Access Denied" errors
- Check IAM permissions for your access keys
- Ensure the bucket policy allows your operations
- For R2, verify the API token has "Object Read & Write" permissions

### Files not accessible by KlingAI
- Signed URLs expire after 2 hours by default
- Check if the URLs are being generated correctly
- Test the URLs directly in a browser

## Cost Considerations

| Provider | Free Tier | Storage Cost | Bandwidth Cost |
|----------|-----------|--------------|----------------|
| CloudFlare R2 | 10GB/month | $0.015/GB | FREE |
| AWS S3 | 5GB for 12 months | $0.023/GB | $0.09/GB |
| Backblaze B2 | 10GB | $0.005/GB | $0.01/GB |

For typical usage (processing a few hours of video per month), CloudFlare R2's free tier should be sufficient.

## Fallback to ngrok

If cloud storage is not configured, the system will automatically fall back to using ngrok. Simply set:

```env
PUBLIC_BASE_URL=https://your-ngrok-url.ngrok-free.app
```

But we strongly recommend setting up cloud storage for a better experience!