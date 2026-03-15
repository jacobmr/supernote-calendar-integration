# Supernote Calendar Integration

## What This Is

An automated integration that syncs Google Calendar with Supernote, creating organized folder structures and pre-populated meeting note templates. Runs as a self-hosted Docker container on an hourly schedule — when a meeting is coming up, a ready-to-use note is already waiting in the right folder.

## Core Value

Clean, findable meeting templates. Every meeting prep begins with an organized note that's easy to locate and ready to fill in.

## Requirements

### Validated

- Query Google Calendar for recurring and ad-hoc meetings — v1.0
- Create folder structure: `/Recurring/[Meeting-Name]/` and `/Ad-Hoc/` — v1.0
- Auto-generate meeting notes with template sections (Agenda, Notes, Action Items, Attendees, Decisions) — v1.0
- Scheduled job (hourly) to check for upcoming meetings and create notes — v1.0
- Supernote API authentication via unofficial adrianba/supernote-cloud-api — v1.0
- Clean meeting note naming: human-readable meeting info instead of Supernote default timestamps — v1.0

### Active

(None — v1.0 shipped all active requirements)

### Out of Scope

- Evernote integration — v1 is Supernote-only
- Email/Slack notifications — focus on note creation
- Template customization UI — hard-coded templates for v1
- Cloud deployment — self-hosted locally
- Offline mode — real-time sync is core value

## Context

Shipped v1.0 with 3,574 LOC TypeScript.
Tech stack: Node.js, Express, Google Calendar API (OAuth2), Supernote unofficial API, Docker.
105 passing tests across 11 suites.
Self-hosted via Docker Compose with health checks and manual trigger endpoint.

## Constraints

- **Tech Stack**: Self-hosted Docker container (not cloud-deployed)
- **API**: Using unofficial Supernote API — verified auth and file upload capabilities
- **Google Auth**: Google Calendar API with OAuth2 token refresh
- **Local Operation**: Single container, JSON file-based state persistence

## Key Decisions

| Decision | Rationale | Outcome |
| --- | --- | --- |
| Use unofficial Supernote API | Official API doesn't exist; community implementation works | Good |
| Scheduled job (hourly) vs real-time | Simpler to implement, sufficient for meeting prep | Good |
| Hybrid folder structure (Recurring + Ad-Hoc) | Recurring meetings get their own folders; ad-hoc grouped together | Good |
| Template sections: Agenda, Notes, Action Items, Attendees, Decisions | Covers meeting prep, execution, and follow-up | Good |
| No notification layer in v1 | Keep scope tight; focus on reliable note creation | Good |
| JSON file-based state persistence | No database needed for single-user self-hosted app | Good |
| 3-step S3 upload flow for Supernote | Required by Supernote Cloud API (apply -> PUT -> finish) | Good |
| Single Docker container with shell script | Simpler than multi-container for Express + scheduler | Good |
| Manual mock objects for integration tests | Real service composition with controllable boundaries | Good |
| Structured logging with createLogger wrapper | No external library needed for single-container app | Good |
| Health endpoint before auth middleware | Docker health check needs unauthenticated access | Good |

---

_Last updated: 2026-03-15 after v1.0 milestone_
