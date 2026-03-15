# Project Issues Log

Enhancements discovered during execution. Not critical - address in future phases.

## Open Enhancements

### ISS-001: Complete ShellHub fleet enrollment

- **Discovered:** Phase 7 Task 2 (2026-03-15)
- **Type:** Infrastructure
- **Description:** ShellHub agent is installed on supernote server (v0.19.2) but hub.salundo.com login is blocked by account activation check. Hub server also has issues: resource constraints (1GB RAM, 88% disk), DNS was broken, fail2ban keeps locking SSH. Need to fix hub login, accept the device, and add SSH key.
- **Impact:** Low (direct SSH works fine for deployment, ShellHub is convenience for fleet management)
- **Effort:** Medium (hub server troubleshooting)
- **Suggested phase:** Future (parallel fix in progress)

### ISS-002: Re-enable UFW firewall with proper config

- **Discovered:** Phase 7 Task 1 (2026-03-15)
- **Type:** Security
- **Description:** UFW was disabled during provisioning due to repeated SSH lockouts. Need to re-enable with ports 22, 80, 443 allowed and verify it doesn't block SSH before leaving it active.
- **Impact:** Medium (server has no firewall currently)
- **Effort:** Quick
- **Suggested phase:** Phase 7 (after deployment is stable)

### ISS-003: Configure fail2ban with sane settings

- **Discovered:** Phase 7 Task 1 (2026-03-15)
- **Type:** Security
- **Description:** fail2ban was disabled/removed because it kept banning legitimate SSH sessions during provisioning. Should be re-installed with reasonable settings (higher maxretry, whitelist for known IPs).
- **Impact:** Medium (brute force protection missing)
- **Effort:** Quick
- **Suggested phase:** Phase 7 (after deployment is stable)

## Closed Enhancements

[Moved here when addressed]
