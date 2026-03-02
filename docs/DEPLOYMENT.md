# Deployment Guide

## Quick Deploy to Railway (Recommended)

### Prerequisites
- [Railway account](https://railway.app) (free tier works)
- [GitHub repository](https://github.com) with your code

### Steps

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Polish and prepare for deployment"
   git push origin main
   ```

2. **Deploy to Railway**
   - Go to [Railway Dashboard](https://railway.dashboard)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Railway will auto-detect the Dockerfile

3. **Configure Environment Variables**
   In Railway project settings, add:
   ```
   NEXT_PUBLIC_SOCKET_URL=https://your-app-name.up.railway.app
   NEXT_PUBLIC_ADSENSE_CLIENT_ID=     # Add after getting AdSense approval
   NEXT_PUBLIC_ADSENSE_BANNER_SLOT=   # Add after getting AdSense approval
   ```

4. **Deploy**
   - Click "Deploy" and wait for build to complete
   - Your app will be live at `https://your-app-name.up.railway.app`

## Alternative: Deploy to Render

### Steps

1. **Push code to GitHub**

2. **Create Render Account**
   - Go to [Render](https://render.com)
   - Connect your GitHub account

3. **Create Web Service**
   - Click "New" → "Web Service"
   - Select your repository
   - Configure:
     - Build Command: `pnpm install && pnpm build`
     - Start Command: `npm run start:prod`

4. **Environment Variables**
   Add same variables as Railway above

5. **Deploy**

## AdSense Setup (After Deployment)

1. Sign up at [Google AdSense](https://adsense.google.com)
2. Add your site URL
3. Wait for approval (can take 1-7 days)
4. Once approved:
   - Get your AdSense Publisher ID (ca-pub-xxxxx)
   - Create ad units in AdSense dashboard
   - Add to Railway/Render environment variables:
     ```
     NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-xxxxx
     NEXT_PUBLIC_ADSENSE_BANNER_SLOT=xxxxx
     ```
5. Redeploy to apply changes

## Troubleshooting

### Socket.IO not working
- Make sure `NEXT_PUBLIC_SOCKET_URL` matches your deployment URL
- Check that both Next.js and Socket.IO are running on the same port

### Build fails
- Ensure pnpm is available: `corepack enable`
- Check that all dependencies are in package.json

### AdSense not showing
- AdSense requires approval - your site must have traffic
- Check browser console for errors
- Make sure ad slots are properly configured
