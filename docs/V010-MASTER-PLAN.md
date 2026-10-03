# Tracky2 V0.10 — Standalone master execution plan

Baseline: [V0.9.2](https://github.com/davemt74-lang/tracky2/releases/tag/v0.9.2), main `ef70eb2c1691903e4ab7e3c4f2ede7ea5b8d5641` at audit. **Independent Tracky2**: no VP3 Cloud/HomeServer code or dependency in this release. The existing shared camera, room audio, speaker identification, transcript, IndexedDB and self-hosted PHP/SQLite infrastructure remain canonical; do not create parallel pipelines.

## Audited current implementation
- `src/room-tracking-core.js`: temporal body tracks/occlusion; `src/scene-analysis.js`: scene readiness and stable public tracks, **not** a semantic scene graph.
- `src/room-event-core.js`: local session observation categories, presence with grace, limited evidence and bound of 120 events. Events use random/time IDs; no deterministic correction/projection/sensor-state model.
- `src/participant-store.js`: IndexedDB v3, opt-in persistent ROOM observations (500 max) and participant-attributed deletion. Not a cross-device event authority.
- `src/room-audio-audit.js`: shared environmental acoustic metadata summaries every ~15 s; no raw recording or sound classifier.
- `vertical-motion.js` and `agent-mode.js`: running perception and optional local conversation; participant sidebar shows only short, post-verified voice segments.
- `server/bootstrap.php`, `server/api.php`, `server/sync.js`: standalone authenticated PHP/SQLite scene/participant/skill registry and manual sync foundation; not an event-sync or executing skill engine.
- `scripts/audit.mjs`, `.github/workflows/test.yml`: reproducible Node and PHP CI, release ZIP and SHA-256; physical hardware validation remains distinct.

## Contracts and architectural invariants
1. One browser camera pipeline, one microphone pipeline and one canonical normalized observation path. Audio activity never proves an individual speaker; camera proximity never proves who spoke.
2. A ROOM event is an immutable record with stable ID, UTC timestamp, optional monotonic elapsed/duration, type (`observation|inference|decision|action|outcome|correction`), category, source, authority, optional independently verified participant ID, confidence/evidence, retention class and event links. Legacy V0.9 observations remain readable through a canonical normalization adapter.
3. An append-only, bounded event history drives deterministic room projection. Corrections reference an earlier event; deduplication uses explicit IDs/observation keys and windows, never text-only merging across different sources.
4. Sensors are explicitly `online|offline|paused|degraded`; offline camera is **not** a participant departure and muted microphone is **not** silence. A process restart cannot manufacture inferred historical observations.
5. No sleep, disease, precise physical distance, isolated individual live microphone waveform or media recognition is asserted without the separately scoped evidence/consent.
6. Persistence is session-only by default. Local opt-in retains bounded metadata and supports clearing and participant deletion; additional server sync requires a later explicit section/consent.
7. A human can inspect evidence and correct or revoke the agent's conclusions. Independent skills require allowlists, permission checks, review and outcome audit.

## Section-by-section delivery sequence
- **Phase 0:** audit and durable plan/checkpoint. Gate: no duplicated subsystem, docs in main, CI green.
- **10A — canonical ROOM events/state:** versioned normalized events, idempotent append, correction links, deterministic projections, sensor outage/recovery handling, bounded opt-in adapter to current ROOM tab, tests. Gate: replay and interruption scenarios pass; PR green/merged.
- **10B — scene graph:** owner-defined camera-relative areas, semantic object links, uncertainty and scene correction. Gate: deterministic geometry and privacy tests.
- **10C — temporal participant movement:** area transitions/dwell and stationary periods without overclaiming posture/sleep; occlusion/reentry evidence. Gate: movement fixtures and interruption tests.
- **10D — audio and dialogue:** privacy-gated ambient classification research/implementation, conservative voice-turn verification, transcript corrections, TTS suppression, optional sound identity with consent. Gate: acoustic false attribution and transcript accuracy fixtures.
- **10E — governed cognitive loop:** observe/verify/interpret/evaluate/decide/act/record and explicit abstention, confidence threshold, cooldown/quiet hours. Gate: deterministic no-action, permitted-action and interruption fixtures.
- **10F — approved skill/task execution:** extend existing standalone skill registry with allowlisted execution/confirmation, cancellation/idempotency, retries and audit; no arbitrary scripts. Gate: permission/security and recovery fixtures.
- **10G — participant memory:** explicit session vs consented durable memory, provenance, corrections/expiry, rights, explanation and deletion. Gate: privacy and revocation tests.
- **10H — standalone PHP/SQLite:** schema migrations, opt-in browser/server synchronization and conflict resolution, encrypted sensitive data, offline recovery; no external project integration. Gate: PHP fresh/upgrade and security fixtures.
- **10I — AGENT/ROOM UI:** coherent responsive ROOM map/timeline/evidence/decisions and participation controls; polish earlier sections as shipped. Gate: browser/mobile accessibility and regression.
- **10J — resilience and release:** long-running budget/latency, camera/mic outage, permission lifecycle, storage and device acceptance with explicit physical hardware limitations. Gate: CI green, real-device evidence recorded separately.

Advanced media identification, live calibrated spatial audio and dedicated video-meeting intelligence are subsequent opt-in sections, not silently implied by this release.

## Mandatory section procedure
For EACH section: (1) audit code, (2) specify acceptance cases, (3) implement using existing pipelines, (4) optimize/review risk, (5) run targeted and required regression/CI, (6) resolve defects, (7) review against 10 gates, (8) PR and merge **only after green**, (9) verify published deploy ZIP + SHA-256, (10) update `docs/DEVELOPMENT-STATUS.md` with exact next action. No next section until previous gate is satisfied. "10/10" is a **delivery-gate score** with documented checks, not a claim that unmeasured hardware or future features are perfect. Avoid rerunning long workflows or racing concurrent repository agents.

## Cross-section acceptance scenario
An enrolled participant enters camera view, moves between configured room areas, remains stationary and speaks over independent ambient noise. ROOM renders timestamped observed facts, uncertainty and optional interpretations separately. Agent may decline interruption according to quiet-hour rules; authorized action generates a recorded result. Outage, correction and deletion must not produce fake departures or resurrect revoked data.
