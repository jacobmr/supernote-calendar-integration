---
phase: 07-production-infrastructure
plan: 02
subsystem: infra
tags: [caddy, tls, docker-compose, lets-encrypt, reverse-proxy, esm-fix]

requires:
  - phase: 07-01-server-provisioning
    provides: Docker Engine, /opt/supernote, existing Caddy for ez3d
provides:
  - HTTPS at supernote.salundo.com with auto-renewing Let's Encrypt cert
  - Production Docker Compose with shared proxy network
  - Caddy reverse proxy routing for supernote app
affects: [07-03-secrets-deploy, 08-production-deployment]

tech-stack:
  added: [caddy-2-alpine (shared with 3dez)]
  patterns: [shared-docker-network-proxy, dynamic-esm-import]

key-files:
  created:
    - Caddyfile
    - docker-compose.prod.yml
  modified:
    - src/services/supernote-api.ts

key-decisions:
  - "Use shared web-proxy Docker network instead of Caddy sidecar — 3dez Caddy already owns ports 80/443"
  - "Update 3dez Caddyfile on server to include supernote site block"

patterns-established:
  - "Shared web-proxy network: new apps join external 'web-proxy' network, 3dez Caddy routes by domain"
  - "Dynamic import() for ESM-only npm packages in CommonJS TypeScript projects"

issues-created: []

duration: 63min
completed: 2026-03-15
---

# Phase 7 Plan 2: Caddy Reverse Proxy & TLS Summary

**HTTPS live at supernote.salundo.com via shared Caddy proxy with auto Let's Encrypt, ESM import bug fixed in supernote-cloud-api**

## Performance

- **Duration:** 63 min (extended by SSH lockouts from fail2ban)
- **Started:** 2026-03-15T15:20:00Z
- **Completed:** 2026-03-15T16:23:32Z
- **Tasks:** 2/2 auto tasks + 1 checkpoint (human-verify)
- **Files modified:** 3

## Accomplishments
- App accessible at https://supernote.salundo.com with valid Let's Encrypt TLS
- HTTP auto-redirects to HTTPS (Caddy 308)
- Production docker-compose.prod.yml with app-only config (no Caddy sidecar)
- Shared `web-proxy` Docker network bridges 3dez Caddy and supernote app
- Fixed ESM-only import crash in supernote-cloud-api

## Task Commits

1. **Task 1: Create Caddyfile and production Docker Compose** — `bd74adc` (feat)
2. **ESM bug fix (Rule 1)** — `0446e36` (fix)

Task 2 was remote-only deployment (no local code changes).

**Plan metadata:** (this commit)

## Files Created/Modified
- `Caddyfile` — Supernote site block reference (actual config lives on server in /opt/3dez/Caddyfile)
- `docker-compose.prod.yml` — Production compose: app-only with shared web-proxy network
- `src/services/supernote-api.ts` — Dynamic import() for ESM-only supernote-cloud-api

## Decisions Made
- **Shared proxy network instead of Caddy sidecar** — 3dez Caddy already owns ports 80/443. Created external `web-proxy` Docker network. Both projects connect to it. Caddy routes by domain name.
- **Update 3dez Caddyfile directly** — Added supernote.salundo.com site block to /opt/3dez/Caddyfile on server. Updated 3dez docker-compose.prod.yml to persist web-proxy network config.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ESM-only import crash in supernote-cloud-api**
- **Found during:** Task 2 (deployment — container crash loop)
- **Issue:** `supernote-cloud-api` has `"type": "module"` (ESM-only), but tsconfig compiles to CommonJS. Runtime `require()` throws `ERR_REQUIRE_ESM`. Bug was hidden because tests mock this module.
- **Fix:** Replaced static `import supernoteApi from "supernote-cloud-api"` with lazy `async getSupernoteApi()` using dynamic `import()`.
- **Files modified:** src/services/supernote-api.ts
- **Verification:** Build clean, 105 tests pass, container runs healthy on server
- **Commit:** `0446e36`

**2. [Rule 3 - Blocking] Adapted deployment for existing Caddy**
- **Found during:** Task 1 (planning deployment strategy)
- **Issue:** Plan specified Caddy Docker sidecar, but 3dez Caddy already holds ports 80/443. Can't run two Caddy instances.
- **Fix:** Created shared `web-proxy` Docker network. App joins network, Caddy routes by domain. Updated 3dez Caddyfile and compose to include supernote.
- **Files modified:** docker-compose.prod.yml (local), /opt/3dez/Caddyfile + docker-compose.prod.yml (remote)
- **Verification:** HTTPS working, ez3d.salundo.com still accessible

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking), 0 deferred
**Impact on plan:** Both fixes necessary — ESM bug prevented app startup, Caddy port conflict prevented deployment. No scope creep.

## Authentication Gates

During execution, fail2ban repeatedly blocked SSH access:
1. Initial SSH timeout — fail2ban had banned our IP (user unblocked via Hetzner console)
2. Post-rsync SSH timeout — rapid connections triggered ban again (user unblocked again)

These are normal gates for this server environment (ISS-003: fail2ban needs sane config).

## Issues Encountered
- **fail2ban aggression** — Banned SSH 2x during deployment. User had to use Hetzner console each time. ISS-003 remains open.
- **Caddy bind mount stale after restart** — `caddy reload` showed "config unchanged" because container had stale mount. Required full container restart to pick up updated Caddyfile.

## Next Phase Readiness
- HTTPS working at supernote.salundo.com with auto-renewing cert
- App running with placeholder .env (real secrets needed from Plan 03)
- Dashboard shows login page (placeholder password)
- Ready for 07-03: SOPS secrets management and deploy script

---
*Phase: 07-production-infrastructure*
*Completed: 2026-03-15*
