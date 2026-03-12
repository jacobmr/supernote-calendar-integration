# Supernote Calendar Integration

Automated integration that syncs Google Calendar with Supernote, transforming upcoming meetings into organized, pre-populated note templates.

## Features

- **Hourly Meeting Detection** - Queries Google Calendar every hour for upcoming meetings
- **Change Detection** - Identifies new, modified, and cancelled meetings
- **State Persistence** - Maintains meeting state to detect changes across runs
- **Extensible Architecture** - Ready for meeting note template generation and folder organization

## Project Status

**Phase 2 Plan 1: Meeting Detection Engine** ✅ Complete

- [x] Hourly scheduled job with Google Calendar query
- [x] Meeting change detection (new, changed, cancelled)
- [x] Local state persistence (JSON file)
- [ ] Phase 3: Folder & organization system (pending Supernote API constraints)

See [.planning/ROADMAP.md](.planning/ROADMAP.md) for full roadmap.

## Quick Start

### Local Development

1. **Clone and install:**

   ```bash
   git clone https://github.com/jacobmr/supernote-calendar-integration.git
   cd supernote-calendar-integration
   npm install
   ```

2. **Set up secrets:**

   ```bash
   # Copy template and fill in your credentials
   cp secrets.env.template .env.local
   # Edit .env.local with your actual credentials
   ```

3. **Build and run:**

   ```bash
   npm run build
   NODE_ENV=production npx ts-node src/index-scheduler.ts
   ```

4. **View results:**
   ```bash
   cat data/meeting-state.json
   ```

### With SOPS (Encrypted Secrets)

If using SOPS for secrets management:

```bash
# Edit encrypted secrets
sops edit --input-type dotenv --output-type dotenv secrets.env.enc

# Run with decrypted env vars
eval "$(sops decrypt --input-type dotenv --output-type dotenv secrets.env.enc)" && npm run build && NODE_ENV=production node dist/index-scheduler.js
```

## Environment Variables

```env
# Google Calendar OAuth2
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
GOOGLE_CALENDAR_ID=primary
GOOGLE_REFRESH_TOKEN=<your-refresh-token>

# Supernote API (unofficial)
SUPERNOTE_EMAIL=<your-email>
SUPERNOTE_PASSWORD=<your-password>
```

See `secrets.env.template` for full list.

## Deployment

### Railway (Recommended)

Railway provides persistent filesystem storage for `data/meeting-state.json` and native cron job support.

1. **Create Railway project from this repo:**
   - Go to [dashboard.railway.app](https://dashboard.railway.app)
   - New Project → Deploy from GitHub
   - Select this repository

2. **Add environment variables:**
   - Railway → Project → Variables
   - Paste decrypted secrets from `secrets.env.enc`

3. **Configure cron job:**
   - Railway → Your Service → Settings → Cron Jobs
   - Schedule: `0 * * * *` (hourly at :00)
   - Command: `npm run build && node dist/index-scheduler.js`

4. **Monitor:**
   - Railway → Logs tab to watch for hourly executions
   - Look for: "New meetings: X, Changed: Y, Cancelled: Z"

**Cost:** Free tier covers ~700 monthly runs (50-200ms each)

### Other Platforms

| Platform              | Notes                                                               |
| --------------------- | ------------------------------------------------------------------- |
| **Render**            | ✅ Free tier, persistent filesystem, native cron                    |
| **Fly.io**            | ✅ Free tier, Cron Machines, persistent storage                     |
| **Local/Home Server** | ✅ Simple node-cron setup, no external dependencies                 |
| **Vercel**            | ⚠️ Requires refactoring to use Blob/Redis for state (no filesystem) |
| **AWS Lambda**        | ⚠️ Same filesystem limitation as Vercel                             |

## Architecture

```
GoogleCalendarService (Phase 1)
    ↓
MeetingDetectorService
    → Queries 30-day window
    → Returns structured meeting data
    ↓
StateManager
    → Loads previous state from disk
    → Detects changes (new/changed/cancelled)
    → Saves current state
    ↓
Scheduler (node-cron)
    → Runs hourly at :00
    → Logs change summaries
    ↓
[Phase 3] Folder creation & note generation
```

## Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- meeting-detector

# Watch mode
npm test -- --watch
```

**Test Results:** 37/37 passing (28 Phase 1 + 9 Phase 2 change detection tests)

## Key Decisions

| Decision                      | Rationale                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| **30-day query window**       | Balance between meeting relevance and API load (600 queries/min available, 1 query/hour = safe) |
| **JSON state file**           | Simple, no database needed for Phase 2. Path: `data/meeting-state.json`                         |
| **Change detection strategy** | Compare entire state, not incremental. Handles edge cases like rescheduled meetings             |
| **Hourly frequency**          | Sufficient for meeting prep. Can adjust via cron expression                                     |

## Development

### Project Structure

```
src/
├── services/
│   ├── google-calendar.ts      # Google Calendar API client (Phase 1)
│   ├── supernote-api.ts        # Supernote unofficial API (Phase 1)
│   ├── meeting-detector.ts     # Meeting query service (Phase 2)
│   ├── state-manager.ts        # State persistence & change detection (Phase 2)
│   └── constants.ts            # Rate limits, retry logic
├── index-scheduler.ts          # Cron job entry point (Phase 2)
└── types/
    └── index.ts                # Shared type definitions

tests/
├── google-calendar.test.ts     # API integration tests (Phase 1)
├── meeting-detector.test.ts    # Change detection tests (Phase 2)
└── ...

.planning/
├── ROADMAP.md                  # Phase breakdown and progress
├── STATE.md                    # Current project state
└── phases/                     # Detailed phase plans and summaries
```

### Extending the Project

**Phase 3: Folder & Organization System**

- Implement Supernote notebook creation API
- Map meeting ID → folder path
- Create `/Recurring/[Meeting-Name]/` and `/Ad-Hoc/` structures

**Phase 4: Note Templates & Generation**

- Design meeting note sections (Agenda, Notes, Action Items, Attendees, Decisions)
- Generate notes with human-readable names and meeting metadata

## Troubleshooting

**"No meetings found"**

- Check that GOOGLE_CALENDAR_ID is set correctly (usually "primary")
- Verify Google Calendar API is enabled in your Google Cloud project
- Confirm refresh token is valid (tokens expire, may need re-auth)

**"State file not persisting"**

- Verify `data/` directory exists and is writable
- Check that `data/meeting-state.json` has correct permissions
- Ensure scheduler has read/write access to the directory

**"Cron job not running on Railway"**

- Railway cron jobs only run on production deployments (not preview)
- Check that cron job is configured in Railway dashboard
- Review logs to see if the endpoint is being called

## Resources

- [Google Calendar API Docs](https://developers.google.com/calendar)
- [Supernote Cloud API (Unofficial)](https://github.com/adrianba/supernote-cloud-api)
- [Railway Cron Jobs](https://docs.railway.app/features/cron-jobs)
- [node-cron Documentation](https://github.com/kelektiv/node-cron)

## License

MIT
