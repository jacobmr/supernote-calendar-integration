# Roadmap: Supernote Calendar Integration

## Overview

An automated integration that syncs Google Calendar with Supernote, transforming upcoming meetings into organized, pre-populated note templates. Starting with API authentication and meeting detection, progressing through folder organization and template generation, then integrating everything into a self-hosted scheduled job that requires no manual intervention.

## Domain Expertise

None

## Milestones

- ✅ **v1.0 MVP** - [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) (Phases 1-6 + 2.2, shipped 2026-03-15)
- 🚧 **v1.1 Production Deploy & Validation** - Phases 7-9 (in progress)

## Completed Milestones

<details>
<summary>v1.0 MVP (Phases 1-6 + 2.2) — SHIPPED 2026-03-15</summary>

- [x] Phase 1: API Setup & Exploration (3/3 plans) — completed 2026-03-11
- [x] Phase 2: Meeting Detection Engine (1/1 plans) — completed 2026-03-11
- [x] Phase 2.2: Web Dashboard (2/2 plans, INSERTED) — completed 2026-03-11
- [x] Phase 3: Folder & Organization System (2/2 plans) — completed 2026-03-15
- [x] Phase 4: Note Templates & Generation (2/2 plans) — completed 2026-03-15
- [x] Phase 5: End-to-End Integration (2/2 plans) — completed 2026-03-15
- [x] Phase 6: Deployment & Polish (2/2 plans) — completed 2026-03-15

</details>

### 🚧 v1.1 Production Deploy & Validation (In Progress)

**Milestone Goal:** Deploy the app to production on supernote.salundo.com and validate end-to-end with real calendar data and Supernote device

#### Phase 7: Production Infrastructure Setup

**Goal**: Server provisioning, Docker deployment, reverse proxy with TLS (Let's Encrypt), and secrets management
**Depends on**: v1.0 complete
**Research**: Likely (new server setup, reverse proxy + TLS configuration, secrets management)
**Research topics**: Server initial setup, Caddy/Nginx reverse proxy config, Let's Encrypt automation, SOPS/env-based secrets
**Plans**: TBD

Plans:

- [x] 07-01: Server provisioning, Docker, ShellHub enrollment (ShellHub deferred)
- [x] 07-02: Caddy reverse proxy, TLS, production Docker Compose
- [x] 07-03: SOPS secrets management, deploy script

#### Phase 8: Production Deployment & Integration

**Goal**: Deploy app with real Google Calendar OAuth, connect to real Supernote account, configure monitoring
**Depends on**: Phase 7
**Research**: Likely (production OAuth flow, real Supernote API integration, monitoring/alerting setup)
**Research topics**: Google OAuth production credentials, Supernote API production access, health monitoring and log aggregation
**Plans**: TBD

Plans:

- [ ] 08-01: TBD (run /gsd:plan-phase 8 to break down)

#### Phase 9: UAT & Validation

**Goal**: Validate calendar sync accuracy, Supernote file quality on real device, and reliability over time; document operational runbook
**Depends on**: Phase 8
**Research**: Unlikely (internal validation and testing)
**Plans**: TBD

Plans:

- [ ] 09-01: TBD (run /gsd:plan-phase 9 to break down)

## Progress

| Phase                                  | Milestone | Plans Complete | Status      | Completed  |
| -------------------------------------- | --------- | -------------- | ----------- | ---------- |
| 1. API Setup & Exploration             | v1.0      | 3/3            | Complete    | 2026-03-11 |
| 2. Meeting Detection Engine            | v1.0      | 1/1            | Complete    | 2026-03-11 |
| 2.2. Web Dashboard (INSERTED)          | v1.0      | 2/2            | Complete    | 2026-03-11 |
| 3. Folder & Organization System        | v1.0      | 2/2            | Complete    | 2026-03-15 |
| 4. Note Templates & Generation         | v1.0      | 2/2            | Complete    | 2026-03-15 |
| 5. End-to-End Integration              | v1.0      | 2/2            | Complete    | 2026-03-15 |
| 6. Deployment & Polish                 | v1.0      | 2/2            | Complete    | 2026-03-15 |
| 7. Production Infrastructure Setup     | v1.1      | 3/3            | Complete    | 2026-03-15 |
| 8. Production Deployment & Integration | v1.1      | 0/?            | Not started | -          |
| 9. UAT & Validation                    | v1.1      | 0/?            | Not started | -          |
