# Roadmap: Supernote Calendar Integration

## Overview

An automated integration that syncs Google Calendar with Supernote, transforming upcoming meetings into organized, pre-populated note templates. Starting with API authentication and meeting detection, progressing through folder organization and template generation, then integrating everything into a self-hosted scheduled job that requires no manual intervention.

## Domain Expertise

None

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: API Setup & Exploration** - Establish working authentication with Google Calendar and Supernote APIs (COMPLETE)
- [ ] **Phase 2: Meeting Detection Engine** - Implement hourly scheduled job to query meetings and detect changes
- [ ] **Phase 3: Folder & Organization System** - Create /Recurring and /Ad-Hoc folder hierarchies
- [ ] **Phase 4: Note Templates & Generation** - Design and implement meeting note templates with all required sections
- [ ] **Phase 5: End-to-End Integration** - Wire all components together and test complete workflow
- [ ] **Phase 6: Deployment & Polish** - Setup self-hosted execution, documentation, error handling

## Phase Details

### Phase 1: API Setup & Exploration

**Goal**: Establish working authentication and basic connectivity with both Google Calendar and Supernote APIs
**Depends on**: Nothing (first phase)
**Research**: Likely (external APIs, unofficial Supernote implementation)
**Research topics**: Google Calendar OAuth2 flow, Supernote cloud API capabilities (unofficial adrianba/supernote-cloud-api), authentication patterns, API rate limits and constraints
**Plans**: 3 plans

Plans:

- [x] 01-01: Google Calendar OAuth2 setup and basic connectivity
- [x] 01-02: Supernote API exploration and authentication (unofficial API)
- [x] 01-03: Verify both APIs work and document initial findings (COMPLETE)

### Phase 2: Meeting Detection Engine

**Goal**: Implement hourly scheduled job that queries Google Calendar for upcoming meetings and detects new/changed meetings
**Depends on**: Phase 1
**Research**: Unlikely (standard scheduling patterns, established job frameworks)
**Plans**: 2 plans

Plans:

- [x] 02-01: Setup hourly scheduled job framework (COMPLETE - 2026-03-11)
- [ ] 02-02: Implement meeting query and change detection logic

### Phase 3: Folder & Organization System

**Goal**: Create and maintain folder hierarchy structure for organized meeting notes
**Depends on**: Phase 2
**Research**: Unlikely (straightforward folder organization)
**Plans**: 2 plans

Plans:

- [ ] 03-01: Implement /Recurring/[Meeting-Name]/ folder structure creation
- [ ] 03-02: Implement /Ad-Hoc/ folder structure and organization logic

### Phase 4: Note Templates & Generation

**Goal**: Design and implement meeting note templates with required sections and generate notes with human-readable names
**Depends on**: Phase 3
**Research**: Unlikely (internal template design, established patterns)
**Plans**: 2 plans

Plans:

- [ ] 04-01: Design template sections (Agenda, Notes, Action Items, Attendees, Decisions)
- [ ] 04-02: Implement note creation with templates and clean naming

### Phase 5: End-to-End Integration

**Goal**: Wire all components together and verify complete workflow from meeting detection to note creation
**Depends on**: Phase 4
**Research**: Unlikely (integration of existing components)
**Plans**: 2 plans

Plans:

- [ ] 05-01: Integration testing for recurring meeting flow
- [ ] 05-02: Integration testing for ad-hoc meeting flow and edge cases

### Phase 6: Deployment & Polish

**Goal**: Setup for self-hosted execution with documentation, error handling, and operational readiness
**Depends on**: Phase 5
**Research**: Unlikely (established deployment patterns)
**Plans**: 2 plans

Plans:

- [ ] 06-01: Self-hosted deployment setup and configuration
- [ ] 06-02: Documentation, error handling, logging, and operational improvements

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase                           | Plans Complete | Status      | Completed  |
| ------------------------------- | -------------- | ----------- | ---------- |
| 1. API Setup & Exploration      | 3/3            | COMPLETE    | 2026-03-11 |
| 2. Meeting Detection Engine     | 1/2            | In Progress | -          |
| 3. Folder & Organization System | 0/2            | Ready       | -          |
| 4. Note Templates & Generation  | 0/2            | Not started | -          |
| 5. End-to-End Integration       | 0/2            | Not started | -          |
| 6. Deployment & Polish          | 0/2            | Not started | -          |
