# Deploying to Railway

Step-by-step guide to deploy the Supernote Calendar Integration to Railway.

## Prerequisites

- Railway account ([railway.app](https://railway.app))
- GitHub repository connected to Railway
- Environment variables from your Google Calendar and Supernote setup

## Deployment Steps

### 1. Create a New Project

1. Go to [Railway Dashboard](https://dashboard.railway.app)
2. Click **New Project**
3. Select **Deploy from GitHub**
4. Find and select `jacobmr/supernote-calendar-integration`
5. Click **Deploy**

Railway will automatically detect the Node.js project and start building.

### 2. Add Environment Variables

Once deployed:

1. Go to your Project → Select the service
2. Click **Variables** tab
3. Add the following (get values from your decrypted `secrets.env.enc` or `.env.local`):

```
GOOGLE_CLIENT_ID=<your-value>
GOOGLE_CLIENT_SECRET=<your-value>
GOOGLE_CALENDAR_ID=primary
GOOGLE_REFRESH_TOKEN=<your-value>
SUPERNOTE_EMAIL=<your-value>
SUPERNOTE_PASSWORD=<your-value>
NODE_ENV=production
```

### 3. Configure Cron Job

1. In your service, go to **Settings** tab
2. Scroll to **Cron Jobs** section
3. Click **Add Cron Job**
4. Fill in:
   - **Schedule**: `0 * * * *` (runs every hour at minute :00)
   - **Command**: `npm run build && node dist/index-scheduler.js`

5. Click **Save**

### 4. Verify Deployment

1. Go to **Deployments** tab to see build status
2. Once deployed, go to **Logs** tab
3. Wait for the next hourly execution (at :00 of the hour)
4. You should see output like:
   ```
   [HH:MM:SS] Scheduler started
   [HH:MM:SS] Detected X new meetings, Y changed, Z cancelled
   [HH:MM:SS] State persisted to data/meeting-state.json
   ```

## Monitoring

### View Logs

Railway stores all logs from cron job executions. In **Logs** tab:
- Filter by date/time
- Search for keywords like "Detected" or "Error"
- Each execution shows the full output

### Alerts (Optional)

Set up Railway alerts for failed deployments:
1. Project → Settings → Notifications
2. Enable email alerts for:
   - Failed deployments
   - Build failures

## Troubleshooting

### "Cron job not running"

**Symptom**: No logs appear at scheduled time

**Solution**:
- Confirm you're on a **production** deployment (not preview)
- Check that cron job is configured (Settings → Cron Jobs)
- Verify the schedule syntax is correct (`0 * * * *` for hourly)
- Check Railway service logs for build errors

### "State file not found"

**Symptom**: `Error: Cannot read property of undefined` when accessing state

**Solution**:
- The `data/` directory is created by Dockerfile
- On first run, `data/meeting-state.json` will be created
- All meetings on first run are marked as "new"
- Subsequent runs will show proper change detection

### "Google Calendar API error"

**Symptom**: `401 Unauthorized` or `invalid_grant`

**Solution**:
- Verify `GOOGLE_REFRESH_TOKEN` is correct and not expired
- If token is expired:
  1. Run local setup to re-authenticate
  2. Extract new token from `tokens.json`
  3. Update `GOOGLE_REFRESH_TOKEN` in Railway variables
  4. Redeploy
- Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` match your Google Cloud project

### "Supernote API error"

**Symptom**: `400 Bad Request` or `401 Unauthorized`

**Solution**:
- Verify `SUPERNOTE_EMAIL` and `SUPERNOTE_PASSWORD` are correct
- Check that your Supernote account is active
- If credentials changed, update Railway variables and redeploy

## Cost

**Included in free tier**:
- 500 total hours of service per month
- Cron job (~50-200ms/run × ~730 runs/month = ~1-2 hours total)
- ✅ Well under free tier limit

**No additional costs** for this project.

## Updating the Code

When you push changes to `main` branch:

1. Railway detects the push automatically
2. Builds and deploys new version
3. Previous version is preserved (rollback available)
4. Cron job continues running on new deployment

To roll back to a previous deployment:
1. Go to **Deployments** tab
2. Find the previous working deployment
3. Click **Restore** to redeploy that version

## Advanced: Custom Domain (Optional)

If you want to expose the service via a custom domain:

1. Project → Domain
2. Add your domain (requires DNS setup)
3. Railway provides CNAME record configuration

*Not needed for cron-only scheduler, but available if you add HTTP endpoints later.*

## Getting Help

- **Railway Docs**: https://docs.railway.app
- **Railway Discord**: Join for community support
- **Project Issues**: Check GitHub repo for known issues

---

**Next Steps After Deployment**:
1. Monitor logs for 2-3 hours to confirm hourly execution
2. Verify state file is persisting correctly
3. Check for accurate change detection (new/changed/cancelled meeting counts)
4. Once stable, can reduce log monitoring to weekly checks
