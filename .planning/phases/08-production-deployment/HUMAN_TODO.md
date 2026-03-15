# Human TODO — Phase 8 Plan 01: Production Credentials

**Status:** Waiting on human action before deploy can proceed

## 1. Create Google Cloud OAuth2 Client

Go to: https://console.cloud.google.com → APIs & Services → Credentials

- [ ] Create an OAuth2 client (type: Web application)
- [ ] Add authorized redirect URI: `https://supernote.salundo.com/oauth/callback`
- [ ] Optionally add `http://localhost:3000/oauth/callback` for local dev
- [ ] Enable the Google Calendar API for the project
- [ ] Copy the **Client ID** and **Client Secret**

## 2. Gather All Credential Values

When you return, provide these to Claude:

| Variable | Source | Value |
|----------|--------|-------|
| `GOOGLE_CLIENT_ID` | Google Cloud Console | |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | |
| `GOOGLE_REDIRECT_URI` | Likely `https://supernote.salundo.com/oauth/callback` | |
| `SUPERNOTE_EMAIL` | Your Supernote account email | |
| `SUPERNOTE_PASSWORD` | Your Supernote account password | |
| `DASHBOARD_PASSWORD` | Choose a strong password | |
| `TZ` | Your timezone (default: `America/New_York`) | |

## 3. Resume

After completing the above:

```
/clear
/gsd:execute-plan .planning/phases/08-production-deployment/08-01-PLAN.md
```

Then provide the credential values at the checkpoint prompt.

## Open Question

**Supernote credentials as env vars vs dashboard UI:** Currently the app reads `SUPERNOTE_EMAIL`/`SUPERNOTE_PASSWORD` from environment variables. You suggested capturing these through a dashboard login flow instead. For v1.1, we'll proceed with env vars. Dashboard-based credential management can be a future enhancement.

---
*Created: 2026-03-15*
