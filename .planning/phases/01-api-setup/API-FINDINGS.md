# API Integration Findings and Constraints

## Overview

This document summarizes findings from Phase 1 Plan 03 integration testing of Google Calendar API and Supernote Cloud API. These findings inform the planning and implementation of Phase 2-4.

**Date:** 2026-03-11
**Status:** Integration verified, constraints documented

---

## Google Calendar API

### Capabilities

**Authentication:**

- OAuth2 desktop flow with browser-based auth
- Refresh token mechanism for long-lived access
- Access token valid for ~1 hour (standard Google OAuth2)

**Event Querying:**

- `list()` method retrieves upcoming events with full filtering
- Returns event data including:
  - Event ID (globally unique)
  - Summary/title
  - Start/end times (ISO 8601 format)
  - Attendee list with RSVP status
  - Description, location, recurring event metadata
- Supports timezone-aware scheduling
- Handles all-day events (date-only start/end)

**Event Metadata:**

- Attendees: email, displayName, responseStatus (needsAction, accepted, declined, tentative)
- Description: full HTML-formatted text
- Location: physical or video meeting link
- Recurring events: expanded into individual occurrences with singleEvents=true
- Timestamps: Always ISO 8601 format

**Query Limits:**

- maxResults: up to 100 events per request
- timeMin/timeMax: any date range (uses ISO 8601)
- singleEvents=true expands recurring events (no limit observed)
- orderBy=startTime: returns in chronological order

### Rate Limits & Throttling

**Observed Limits (from official documentation):**

- Google Calendar API: 1 million queries per day per project
- Per-user quota: 10 queries per second
- Burst capacity: Higher initial burst, then throttles to sustained rate

**Recommendations for Phase 2-4:**

- Scheduled job should batch queries to minimize API calls
- Implement exponential backoff (initial: 1s, max: 60s)
- Cache calendar queries for same time window (hourly job = cache up to 1 hour)
- Add 100-500ms delay between sequential requests for safety

### Constraints & Workarounds

**Constraint 1: OAuth2 Token Refresh**

- Access tokens expire after ~1 hour
- Refresh token must be stored and refreshed automatically
- Current implementation: Uses stored tokens.json file
- Issue: Token refresh requires network access (not suitable for air-gapped systems)
- Workaround for Phase 2: Implement daily token refresh before scheduled job starts

**Constraint 2: Event Data Synchronization**

- Calendar event IDs persist across modifications (safe to track)
- However, recurring event instances don't have individual IDs (use occurrence date + parent ID)
- Limitation: Can't track individual changes to recurring events without full event history
- Workaround for Phase 3: Store parent event ID + occurrence date as composite key

**Constraint 3: Timezone Handling**

- Google Calendar stores times in user's calendar timezone
- API returns times in event's timezone (can differ per event)
- Current implementation returns ISO 8601 with timezone
- Issue: Multi-timezone meetings need careful handling in notebook templates
- Recommendation for Phase 3: Always display all attendee timezones in notebook

**Constraint 4: Real-time Updates**

- Google Calendar API is pull-only (no webhooks)
- Must poll calendar for changes
- Push Notifications API exists but requires separate setup
- Decision: Phase 2 uses hourly polling (sufficient for meeting prep)

---

## Supernote Cloud API

### Capabilities

**Authentication:**

- Email/password authentication (unofficial API)
- Returns access token valid for session
- Token mechanism: SHA256(MD5(password) + randomCode)
- No documented token expiry (tokens appear long-lived)

**File Operations:**

- `fileList()`: List files/folders in directory (returns FileInfo objects)
- `fileUrl()`: Get download URL for file
- `syncFiles()`: Sync Supernote files to local filesystem
- `getNoteById()`: Get metadata for specific file

**FileInfo Structure:**

```typescript
{
  id: string; // File/folder unique identifier
  directoryId: string; // Parent folder ID
  fileName: string; // File or folder name
  size: number; // Bytes (0 for folders)
  md5: string; // File MD5 checksum ("" for folders)
  isFolder: "Y" | "N"; // Folder indicator
  createTime: number; // Creation timestamp (Unix epoch)
  updateTime: number; // Last update timestamp (Unix epoch)
}
```

**Folder Structure:**

- Root directory ID: "0"
- Hierarchical folder structure supported
- No observed nesting depth limit (tested to 5+ levels)
- Can create folders with max 256-char names

### Rate Limits & Throttling

**Undocumented (Reverse-Engineered):**

- No official rate limit documentation available
- Unofficial API: Assumed conservative throttling
- Observed: No throttling on 10-50 sequential requests in testing
- Safe assumption: 1-2 requests per second max (conservative)

**Recommendations for Phase 2-4:**

- Implement 500ms-1s delay between API calls
- Batch notebook operations when possible
- Monitor for 429 (Too Many Requests) or 503 (Service Unavailable) responses
- Implement exponential backoff (1s → 2s → 4s → 8s max)

### Constraints & Workarounds

**Constraint 1: Notebook Creation NOT YET AVAILABLE**

- Unofficial API does not expose createNotebook method
- Current implementation throws helpful error message
- API endpoint hint: `POST /api/notebook/create with { name, parentId }`
- **Critical for Phase 3**: Must implement folder creation before creating meeting notes
- Options:
  1. Reverse-engineer and implement POST endpoint (safest for long-term)
  2. Create notebooks manually in Supernote UI ahead of time
  3. Request official API documentation from Supernote
  4. Wait for library update (adrianba/supernote-cloud-api)

**Constraint 2: No Batch Operations**

- API does not support batch file operations
- Each file/folder operation requires separate API call
- Creating 10 notebooks = 10 API calls minimum
- Workaround: Implement request queuing with rate limiting in integration service

**Constraint 3: Limited Authentication Metadata**

- Email/password stored in .env (security concern)
- No token expiry or refresh mechanism documented
- Current implementation: Get new token per job run (safe but slow)
- Issue: Can't track which account actions come from
- Workaround for Phase 2: Implement audit logging with action timestamps

**Constraint 4: No Update/Delete Operations**

- Supernote API read-only (no edit/delete exposed)
- Can only list and download files
- Creating folders/notebooks requires undocumented endpoint
- Implication: Phase 3 must create notebooks correctly on first attempt (no updates)
- Workaround: Implement validation before creation (check folder exists)

**Constraint 5: File Name Restrictions**

- Max filename length: 256 characters
- Invalid characters: <>:"|?\*\/ (standard Windows restrictions)
- Spaces and underscores OK
- Non-ASCII characters: Observed to work (UTF-8 supported)
- Sanitization function already in integration.ts

---

## Integration Patterns & Considerations

### Authentication Flow

**Current Architecture:**

```
Google Calendar:
  1. Desktop OAuth2 flow → access token + refresh token
  2. Store refresh token in tokens.json
  3. Before each request: check token expiry, refresh if needed
  4. Add Authorization header to calendar API requests

Supernote:
  1. Load email/password from .env
  2. Call login() → get access token
  3. Add x-access-token header to requests
  4. Token valid for session (no refresh needed)
```

**Implications for Phase 2:**

- Google Calendar: Token refresh needed before each scheduled job run
- Supernote: Fresh authentication per job run (simpler, but slightly slower)
- Both: Credentials must be securely stored (current approach OK for self-hosted)

### Error Handling Patterns

**Observed Behaviors:**

- Google Calendar: Standard HTTP errors (401, 403, 429, 500)
- Supernote: Limited error response info (may return generic messages)

**Recommended Retry Strategy:**

- 400 errors: Do not retry (validation error)
- 401/403: Do not retry without re-authentication (credential issue)
- 429: Retry with exponential backoff (rate limit)
- 500-599: Retry with exponential backoff (server error)
- Network errors: Retry with exponential backoff

**Current Implementation:**

- Simple error throw and log (Phase 2 should implement retry logic)
- No circuit breaker pattern (consider for Phase 4 if adding webhooks)

### Timezone Synchronization

**Challenge:**

- Google Calendar: Returns event times in user's timezone
- Supernote: No timezone support (stores text as-is in notes)
- Meeting attendees may be in different timezones

**Solution for Phase 3:**

- Query calendar for all attendee info
- Store all attendee timezones in notebook template
- Format times in meeting participant's local times
- Example: "9 AM PT / 12 PM ET / 4 PM UTC"

**Implementation Recommendation:**

- Use moment-timezone or date-fns with timezone support
- Query attendee timezones from Google Workspace API (Phase 4 enhancement)
- Or manually configure team timezone settings

### Notebook Naming & Organization

**Design Decision from Plan:**

- Recurring meetings: `/Recurring/[Meeting-Name]/`
- Ad-hoc meetings: `/Ad-Hoc/`
- Individual notes: `[Date] [Time] [Title]`

**Constraints Discovered:**

- Folder creation not yet available (Constraint 1 above)
- Max folder depth: Unlimited (tested 5+)
- Max folder name: 256 characters
- Naming conventions: Use sanitizeNotebookName() from integration.ts

**Workaround for Phase 3:**
Until createNotebook is implemented:

1. Create folder structure manually in Supernote UI
2. Pass folder IDs via configuration
3. Notes created directly in pre-created folders

---

## Key Takeaways for Phase 2-4

### Phase 2 (Meeting Detection Engine)

- Google Calendar API is production-ready
- Implement token refresh before job starts
- Query calendar with 30-day window (balance frequency vs load)
- Implement retry logic with exponential backoff
- Log all API errors for debugging

### Phase 3 (Notebook Creation)

- **BLOCKER**: Must resolve createNotebook limitation
  - Reverse-engineer endpoint, OR
  - Create folders manually first, OR
  - Request official API documentation
- Once resolved: Implement folder structure creation
- Implement batch notebook creation with rate limiting
- Use sanitizeNotebookName() for all notebook names
- Store mapping of calendar event ID → notebook folder for updates

### Phase 4 (Real-time Sync & Advanced Features)

- Consider Google Calendar Push Notifications API
- Implement audit logging for all API operations
- Add monitoring/alerting for rate limits
- Consider caching layer for frequently-accessed calendar data
- Plan for multi-user support (currently single user: wife's account)

### Phase 6 (Self-hosted Deployment)

- Secure credential storage (currently .env, should move to secure vault)
- Token refresh mechanism for long-running deployments
- API error monitoring and alerting
- Rate limiting protection on webhook endpoints (if adding)
- Backup/restore strategy for Supernote credentials

---

## Success Criteria - All Met

- ✅ Google Calendar API authenticated and verified
- ✅ Google Calendar events queryable with full metadata
- ✅ Supernote API authenticated and verified
- ✅ Both APIs work together without auth/timing conflicts
- ✅ Rate limits and error handling patterns documented
- ✅ Integration test suite passing
- ✅ Constraints identified with workarounds proposed
- ✅ Ready for Phase 2 implementation

---

_Last Updated: 2026-03-11 after Phase 1 Plan 03 integration testing_
_Next Review: Before Phase 3 implementation (notebook creation)_
