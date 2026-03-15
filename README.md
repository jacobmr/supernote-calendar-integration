# Supernote Calendar Integration

Automatically syncs Google Calendar with Supernote by creating organized folder structures and pre-populated meeting note templates. When a meeting is upcoming, a ready-to-use note is created in the right folder — no manual setup needed.

## Quick Start

```bash
cp .env.example .env
# Fill in your Google OAuth2 and Supernote credentials (see Configuration below)
docker compose up -d
```

The dashboard is available at `http://localhost:3000`. Default password: `admin`.

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | Yes | — | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | — | Google OAuth2 client secret |
| `GOOGLE_REDIRECT_URI` | No | `http://localhost:3000/oauth/callback` | OAuth2 redirect URI |
| `TOKEN_STORE_PATH` | No | `./tokens.json` | Path to store OAuth2 tokens |
| `SUPERNOTE_EMAIL` | No | — | Supernote account email |
| `SUPERNOTE_PASSWORD` | No | — | Supernote account password |
| `DASHBOARD_PASSWORD` | No | `admin` | Password for web dashboard |
| `PORT` | No | `3000` | Server port |
| `TZ` | No | `America/New_York` | Timezone for scheduling |
| `LOG_LEVEL` | No | — | Set to `debug` for verbose logging |

If Supernote credentials are not set, the scheduler still detects calendar changes but skips folder/note creation.

## Google Calendar Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) and create a project
2. Enable the **Google Calendar API**
3. Create **OAuth2 credentials** (Desktop application type)
4. Copy the Client ID and Client Secret into your `.env` file
5. Start the app and complete the OAuth2 consent flow in your browser
6. Tokens are persisted to `tokens.json` and refresh automatically

## Architecture

Single Docker container running two processes via `start.sh`:

- **Express server** — Web dashboard for status, setup, and manual triggers
- **Cron scheduler** — Hourly job that queries Google Calendar, detects meeting changes, and creates Supernote folders/notes

State is stored as JSON files in the `data/` directory (mounted as a Docker volume):

- `meeting-state.json` — Last known meeting state for change detection
- `scheduler-status.json` — Last run status for the dashboard
- `folder-mappings.json` — Meeting-to-folder mapping cache

## Manual Trigger

Run the scheduler immediately instead of waiting for the next hourly cycle:

```bash
curl -X POST http://localhost:3000/api/trigger \
  -b "authenticated=true"
```

Requires authentication. Use the dashboard button for browser-based triggering.

## Health Check

```bash
curl http://localhost:3000/health
# {"status":"ok","uptime":12345.678}
```

Docker Compose includes an automatic health check that polls this endpoint every 30 seconds.

## Development

```bash
npm install
npm run build
npm test
```

## Troubleshooting

**Missing credentials at startup**
The scheduler exits with an error if `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` are not set. Check your `.env` file.

**OAuth2 token expired**
Tokens refresh automatically. If refresh fails, delete `tokens.json` and restart to re-authenticate.

**Supernote API errors**
The unofficial Supernote API may occasionally return errors. The scheduler retries with exponential backoff (up to 3 retries). Check logs with `docker compose logs -f`.

**Scheduler shows "unhealthy"**
After 3 consecutive hourly failures, the scheduler logs an unhealthy warning. It keeps running — the next successful run resets the counter. Check `data/scheduler-status.json` for the last error.

**Container won't start**
Ensure `data/` directory exists and is writable. The app creates it automatically, but Docker volume mounts may need correct permissions.

**Port already in use**
Change the `PORT` variable in `.env` and update the port mapping in `docker-compose.yml`.
