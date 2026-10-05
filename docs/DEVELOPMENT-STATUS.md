# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V012-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. Tracky2 remains standalone.

## Completed and verified
- **V0.10A–10J** — complete.
- **V0.11A–11J** — complete at **V0.11.9**. Final V0.11 merge: `2cd4cda227b611fa7615019a8c3f1b42900edfc5`. Software delivery **10/10**.
- **V0.12 planning** — PR #54 merged at `07667d9f3a47fec2d3bf370bc8294d3d91836fb1`.
- **12A — Canonical Multimodal Identity Fusion** — PR #55 merged at `4a13ee8b1616a900ced3b4f5aaac0708cf4c6305`. V0.12.0 post-merge green. **10/10**.
- **12B — Shared-Microphone Diarization** — PR #56 merged at `d8ae0b728851fa40bebfd8b90b65f588f3359e7d`. V0.12.1 post-merge green. **10/10**.
- **12C — Continuous Camera + Voice Fusion** — PR #57 merged at `348244185c372cd9ca7420ec93b8f677aa3dcc23`. V0.12.2 post-merge green. **10/10**.
- **12D — Real-Time Multi-Person Attribution** — PR #58 merged at `709155df72da0f9793e5034561f25ab523047c6f`. V0.12.3 post-merge green. **10/10**.
- **12E — Recording & Session Identity Timeline** — PR #59 merged at `3420c5a1402cae6b55c2748a04c5a356e8b56558`. V0.12.4 post-merge green. **10/10**.
- **12F — Multi-Room / Handoff Intelligence** — PR #60 merged at `f13168c9b5f338fac73d3d653679865ad339429e`. V0.12.5 post-merge green. **10/10**.
- **12G — Advanced Spatial + Audio Source Intelligence** — PR #61 merged at `306c9c7007b29253a874d421c602fcf0906f9867`. V0.12.6 post-merge green. **10/10**.
- **12H — Agent Multimodal Reasoning** — PR #62 merged at `20ce21e5fa370be2a5b7f0b65ad01346206efa50`. V0.12.7 post-merge Node/package/PWA + PHP green and deploy artifact verified. **10/10**.
- Physical camera/microphone representative-device evidence remains separate from CI.

## Active section: 12I — Long-Session / Stress Hardening
- **Branch:** `feat/v012i-long-session-stress-hardening`.
- **Audited baseline:** **8.0/10**. Core listening queues, ROOM history, player activity, diarization clusters and visual fusion history were already bounded, but participant-scoped transient Sets/Maps could retain deleted/churned IDs, AGENT greeting/history state lacked deletion reconciliation, page-exit cancellation was split across lifecycle handlers, and continuous-fusion links had no independent defensive cap.
- Added pure `src/long-session-core.js` with bounded participant-reference reconciliation, transient dialogue participant scrubbing, long-session health checks and restart-integrity checks.
- Removed write-only `announcedTracks` retention; it grew with track churn but was never read.
- Participant reload/deletion now reconciles announced participants, seen-participant state, gameplay zone maps, current transient dialogue references, continuous speaker fusion and AGENT participant-scoped state.
- Current transient dialogue now mirrors the canonical deletion boundary: directly attributed turns for a deleted participant disappear; embedded nearby/conversation/addressed/multimodal/continuous-fusion/multi-person references are scrubbed.
- AGENT now prunes deleted participant IDs from its greeting cooldown map and participant-scoped local AGENT history, clears a removed last-speaker reference, and rewrites saved local history when enabled.
- Continuous speaker fusion now has an independent **8-link hard cap** in addition to diarization's existing cluster cap and participant reconciliation.
- Existing bounds remain verified: listening queue max/deadlines + generation invalidation; diarization max clusters/windows; visual history max entries/age; ROOM max 120 events; player activity max 36; proactive pending/interruption limits; trace max 600.
- Added idempotent runtime-exit preparation. Non-bfcache page exit cancels camera/microphone recovery, invalidates queued/processing listening work by generation, clears transcript/diarization/continuous-fusion transient state and visual history, and disables environmental audio work before unload cleanup.
- Manual camera/microphone stops already cancel recovery timers and remain authoritative; sensor loss still does not imply participant absence or room silence.
- Browser storage pressure continues to pause optional ROOM persistence at the critical threshold; no raw media is introduced into persistence.
- Release target: **V0.12.8** with package/PWA/runtime-audit/deploy-manifest wiring.
- Deterministic stress fixtures cover 1,000 listening enqueues, 500 diarization assignments, pathological fusion cluster churn, 5,000 visual-history updates, 1,000 ROOM/activity events, participant churn/deletion, recovery budget exhaustion, storage pressure, restart integrity and pure-core privacy.
- **Pre-CI score: 9.7/10.** Remaining 0.3 is full Node/package/PWA + PHP proof, PR merge, post-merge verification and V0.12.8 artifact validation.

## Exact next action
Open the 12I PR, repair only demonstrated failures, merge when all required checks are green, verify post-merge V0.12.8 packaging, score 12I **10/10**, then begin **12J — V0.12 Release** from merged main.
