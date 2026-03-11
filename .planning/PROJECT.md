# Supernote Calendar Integration

## What This Is

An automated integration that syncs Google Calendar with Supernote, creating organized folder structures and pre-populated meeting note templates. When your wife has an upcoming meeting, she finds a ready-to-use note already waiting in the right folder—no manual setup needed.

## Core Value

Clean, findable meeting templates. Every meeting prep begins with an organized note that's easy to locate and ready to fill in.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Query Google Calendar for recurring and ad-hoc meetings
- [ ] Create folder structure: `/Recurring/[Meeting-Name]/` and `/Ad-Hoc/`
- [ ] Auto-generate meeting notes with template sections (Agenda, Notes, Action Items, Attendees, Decisions)
- [ ] Scheduled job (hourly) to check for upcoming meetings and create notes
- [ ] Supernote API authentication via unofficial adrianba/supernote-cloud-api
- [ ] Clean meeting note naming: human-readable meeting info instead of Supernote default timestamps

### Out of Scope

- Evernote integration — v1 is Supernote-only
- Email/Slack notifications — focus on note creation
- Template customization UI — hard-coded templates for v1
- Cloud deployment — self-hosted locally

## Context

**Stack:**
- Google Calendar API (for meeting data)
- Supernote unofficial API (adrianba/supernote-cloud-api) for folder/note operations
- Self-hosted, runs as scheduled job
- User: wife's Supernote account

**Problem it solves:**
- Meetings create default notes with long timestamp IDs instead of useful names
- No automatic organization of meeting prep materials
- Manual folder and note creation for every meeting

**Why it matters:**
Meeting prep shouldn't require manual setup. A template and proper organization removes friction and ensures consistency across all meetings.

## Constraints

- **Tech Stack**: Self-hosted scheduled job (not cloud-deployed)
- **API**: Using unofficial Supernote API — need to verify auth approach and capabilities
- **Google Auth**: Google Calendar API integration (assume OAuth2 setup available)
- **Local Operation**: Must run on a single machine/server, not distributed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use unofficial Supernote API | Official API may not exist; community implementation is available | — Pending |
| Scheduled job (hourly) vs real-time | Simpler to implement, sufficient for meeting prep | — Pending |
| Hybrid folder structure (Recurring + Ad-Hoc) | Recurring meetings get their own folders for consistency; ad-hoc grouped together | — Pending |
| Template sections: Agenda, Notes, Action Items, Attendees, Decisions | Covers meeting prep, execution, and follow-up | — Pending |
| No notification layer in v1 | Keep scope tight; focus on reliable note creation | — Pending |

---

*Last updated: 2026-03-11 after initialization*
