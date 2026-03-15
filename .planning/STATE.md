# Project State - Supernote Calendar Integration

**Last Updated**: 2026-03-15
**Current Phase**: 7 of 9 (Production Infrastructure Setup)
**Total Phases**: 9

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** Clean, findable meeting templates
**Current focus:** v1.1 Production Deploy & Validation

## Current Position

Phase: 7 of 9 (Production Infrastructure Setup)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-03-15 — Completed 07-02-PLAN.md

Progress: ██░░░░░░░░ 20%

## Key Decisions Made

See .planning/PROJECT.md Key Decisions table for full log.

| Phase | Decision                        | Rationale                                               |
| ----- | ------------------------------- | ------------------------------------------------------- |
| 7     | Skip ShellHub enrollment        | Hub login broken, direct SSH works, fix deferred        |
| 7     | Disable UFW during provisioning | Repeated lockouts, re-enable after deploy               |
| 7     | Use existing Caddy on server    | Already serving ez3d.salundo.com, add supernote as site |
| 7     | Shared web-proxy Docker network | 3dez Caddy owns ports 80/443, supernote joins via external network |

## Current Constraints & Blockers

- Server at 37.27.198.218 provisioned with Docker 29.3.0
- Domain supernote.salundo.com pointed at the server
- SSH access working (direct, no ShellHub yet)
- **HTTPS live** at supernote.salundo.com (Let's Encrypt, auto-renew)
- Caddy shared via `web-proxy` Docker network (3dez Caddy routes both domains)
- App running with placeholder .env (real secrets needed in Plan 03)
- UFW disabled — re-enable after deployment (ISS-002)
- ShellHub deferred — parallel fix (ISS-001)

## Architecture

### Current Stack

- **Runtime**: Node.js / TypeScript (3,574 LOC)
- **Web Server**: Express on port 3000 (password-protected)
- **Dashboard**: Inline HTML/CSS/JS, dark mode
- **Scheduler**: node-cron (every hour at :00)
- **State Storage**: JSON files (meeting-state.json, scheduler-status.json, folder-mappings.json)
- **Container**: Docker Compose with health check
- **Tests**: 105 passing across 11 suites

### Production Server (37.27.198.218)

- **OS**: Ubuntu 24.04 LTS, 2 CPU, 3.7GB RAM, 38GB disk
- **Docker**: 29.3.0 + Compose v5.1.0
- **Co-hosted**: ez3d.salundo.com (Caddy + frontend + backend)
- **App dir**: /opt/supernote

## Performance Baselines

- Build time: ~2 seconds
- Test execution: ~5 seconds (105 tests)
- Scheduler job: ~50-200ms per run

### Roadmap Evolution

- Milestone v1.0 created: MVP — API setup through deployment, 6 phases (Phase 1-6 + 2.2)
- Milestone v1.0 shipped: 2026-03-15
- Milestone v1.1 created: Production deploy & validation, 3 phases (Phase 7-9)

## Deferred Issues

- ISS-001: ShellHub fleet enrollment (hub login broken)
- ISS-002: Re-enable UFW firewall
- ISS-003: Configure fail2ban with sane settings

## Session Continuity

Last session: 2026-03-15
Stopped at: Completed 07-02-PLAN.md
Resume file: None

---

_v1.0 shipped. v1.1 in progress. See .planning/MILESTONES.md for milestone record._
