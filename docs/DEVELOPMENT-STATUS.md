# Tracky2 — Standalone development execution checkpoint

GitHub main is authoritative. Resume: read `docs/V010-MASTER-PLAN.md`, then check main, open PRs and CI before any new edits. Do not infer that unmerged sections are complete.

## Completed
- **Phase 0**: [PR #32](https://github.com/davemt74-lang/tracky2/pull/32) merged `b706945c09c1b30798857b05cd46f5545e9d6db9`; PR and post-merge CI green. Baseline audit, ten-section plan and release idempotence guard delivered.
- **10A**: [PR #33](https://github.com/davemt74-lang/tracky2/pull/33) merged `08fc61ea25892a941eee4bf49ebd8281f36e302a`; PR and post-merge Node/PHP CI green. Delivery gate **10/10** (audit, contract, tests, reuse, privacy, recovery, review, PR, CI, package); no physical hardware acceptance claimed.
- **Latest verified deployment:** [V0.10.0 standalone ZIP](https://github.com/davemt74-lang/tracky2/releases/download/v0.10.0/tracky2-v0.10.0-deploy.zip), SHA-256 `b9ea8253396ea890b9fb4c1c9d9c95cd0a153758075069d983ec5d823ed0010e`. Full ZIP + checksum sidecar verified in GitHub release.

## Current section: 10B — standalone scene graph
- **Working branch:** `feat/v010b-standalone-scene-graph`, based on 10A main merge; status is **implementation in progress**, not released.
- **Scope:** owner-editable local camera-relative areas; bounded semantic object labels/area relationships; runtime conservative associations of visible tracks to areas; uncertainty and human corrections; one local IndexedDB scene map, no new camera/recognition system.
- **Privacy and correctness:** no automatic physical distance claims, snapshots, biometric uploads or Cloud/HomeServer integration. Unmatched visitors must not receive enrolled participant IDs. Do not equate a camera-defined region with calibrated floor coordinates.
- **Next exact work:** add deterministic `src/room-scene-graph.js` and tests; wire a labelled room-area editor/preview to ROOM and existing IndexedDB; update npm/PWA/deploy package/version; open 10B PR, wait for both required checks, merge then verify post-merge V0.10.1 direct ZIP+SHA before starting 10C.
- **Hardware:** no installed real-camera acceptance for 10B yet. Record separately from automated fixtures.

All subsequent work stays inside standalone Tracky2. Do not alter the HomeServer or VP3 Cloud repositories.
