# Tracky2 V0.13 — Real-World Agent Intelligence & Reliability

Baseline: V0.12.9, main `dbbb0f2038507fb5840544bc294552cb9a19ba75`. **Tracky2 remains standalone for V0.13.** Do not add VP3 Cloud, HomeServer, remote-agent, or cross-product dependencies unless a later explicitly approved release changes that boundary.

V0.13 moves Tracky2 from a strong bounded multimodal software runtime toward reliable real-world operation on representative devices. It does not relax the V0.12 identity, privacy, transcript, deletion, or no-teleport rules. It extends the existing canonical microphone, participant, transcript, ROOM, session, meeting, recall, and AGENT systems instead of creating parallel authorities.

## V0.13 invariants

1. **One canonical live room microphone remains authoritative.** Source separation, diarization, environmental classification, voice matching, and transcription must extend that path rather than opening parallel microphones.
2. **One canonical transcript authority remains authoritative.** Separated speaker streams may annotate or improve attribution, but must not create competing transcript histories.
3. **Identity is never inferred from proximity, source direction, one body track, or AGENT reasoning alone.** Voice/face/body continuity remain distinct evidence classes.
4. **Unknown/conflict/overlap remain valid outputs.** A model may abstain; degraded hardware must fail less-specific, not more-confident.
5. **Representative-device evidence is explicit and local.** CI proves deterministic software contracts; real camera/microphone/browser exercises prove only the tested configuration.
6. **No hidden raw-media retention.** New recording features require explicit consent, lifecycle, retention, playback, deletion, export boundaries, and clear owner controls.
7. **No hidden surveillance behavior.** Camera/mic use stays visible and owner-controlled; no background activation or covert recording.
8. **No emotion, diagnosis, protected-trait, or health inference.** Environmental and behavioral intelligence describes bounded observable events/routines, not sensitive conclusions.
9. **No teleport inference.** Cross-room continuity requires explicit handoff/current evidence; unseen routes remain unknown.
10. **AGENT cannot override canonical identity, transcript corrections, participant deletion/revocation, meeting policy, or memory authority.**
11. **Long-run state is bounded.** Queues, cluster maps, histories, retries, recording indexes, routine windows, proactive state, and per-participant caches must have explicit caps/expiry.
12. Every section follows **audit → scored baseline → acceptance contract → implementation → deterministic tests → PR → green CI → merge → post-merge verification → artifact/checksum**.

## Audited V0.12.9 baseline

The current codebase already provides:
- one shared room microphone with VAD, transcription, voice-profile matching, environmental audio, bounded diarization, and optional stereo directional context;
- canonical multimodal identity fusion across voice, face/body continuity, temporal and spatial evidence;
- continuous camera/voice fusion, multi-person turn attribution, overlap states, owner speaker corrections, and transcript provenance;
- canonical session identity timeline with ROOM/transcript/meeting references;
- explicit room identity and no-teleport handoff rules;
- owner-calibrated visual spatial context plus optional audio-source direction;
- AGENT multimodal reasoning with no identity override, participant-memory isolation, meeting policy, and bounded proactive behavior;
- bounded long-session state, recovery budgets, deletion propagation, PWA packaging, diagnostics, release ZIP/SHA-256, and explicit software-vs-hardware certification boundaries.

The largest remaining gaps are true overlapping-speaker source separation, representative-device certification depth, stronger long-gap participant continuity, real multi-node room operation, a canonical saved-recording subsystem, richer bounded environmental/routine intelligence, and multi-hour physical-device hardening.

## Section sequence and baseline scores

### 13A — Representative Hardware Certification
**Baseline: 7.4/10.**

Existing strengths:
- `diagnostics.html/js` camera and microphone transport tests;
- aggregate FPS/coverage/dropout/rejected-jump metrics;
- permission/storage/runtime resilience checks;
- manual representative-device checklist;
- local redacted JSON export;
- clear statement that CI is not universal hardware certification.

Missing:
- no structured device/browser/OS/environment profile in the report;
- microphone test is mono transport only and does not report input channel capability/stereo fallback;
- no automated reconnect/permission-transition evidence ledger;
- no timed long-session checkpoint model;
- no standardized PASS / PARTIAL / FAIL certification result;
- no cryptographic report integrity/checksum;
- no explicit V0.13 capability matrix proving which advanced features were actually exercised;
- no repeatable redaction contract for every exported field;
- no certification history/import comparison.

**13A target:** create a pure certification core plus upgraded diagnostics workflow that records only aggregate/device metadata, capability probes, test outcomes, timestamps, bounded notes, report integrity, and explicit unsupported/not-run states. It must not record media or claim universal certification.

**Gate:** camera coverage/performance; mono/stereo mic capability; permission revoke/restore; camera/mic disconnect/reconnect; foreground resume; restart integrity; storage pressure; 20+ minute checkpoint; feature capability matrix; redacted report; deterministic result scoring; report checksum; no raw media/biometrics/transcripts.

### 13B — Overlapping-Speaker Source Separation V2
**Baseline: 5.8/10.**

Existing strengths:
- one shared microphone;
- bounded diarization clusters/windows;
- overlap detection/explicit unresolved overlap;
- continuous camera/voice fusion and multi-person interval attribution;
- optional stereo energy direction.

Missing:
- no true separation of simultaneous speech into independently attributable PCM estimates;
- no separation quality/SNR/reconstruction confidence contract;
- no separated-stream cancellation/backlog budget;
- no safe fallback from failed separation to current unresolved-overlap behavior.

**Target:** bounded optional separation over accepted shared-mic PCM only, preserving the one-mic rule and canonical transcript authority.

**Gate:** clean two-speaker overlap, weak overlap, three-speaker refusal, silence/noise, separation quality thresholds, attribution abstention, cancellation, bounded backlog, mono fallback, no second mic/store.

### 13C — Advanced Participant Continuity
**Baseline: 7.6/10.**

Existing strengths:
- face identity;
- full-body continuity;
- occlusion/reacquiring states;
- multimodal voice/visual fusion;
- participant deletion/revocation;
- explicit room handoff and same-room re-entry.

Missing:
- longer re-entry windows with stronger decay rules;
- appearance-change continuity;
- track fragmentation reconciliation;
- continuity confidence history;
- stronger duplicate-person protection across long occlusion;
- explicit owner correction/recovery path for continuity mistakes.

**Gate:** long occlusion, clothing/orientation change, track fragmentation, re-entry, duplicate visible candidates, voice-only recovery, visual-only abstention, owner correction, deletion/revocation, no identity transfer.

### 13D — Multi-Room Runtime V2
**Baseline: 6.3/10.**

Existing strengths:
- physical room IDs/names;
- explicit handoff/departure;
- no-teleport rules;
- room-scoped ROOM events;
- session timeline room metadata.

Missing:
- no actual multiple live room/camera nodes;
- no node presence/health registry;
- no cross-node observation handoff protocol;
- no clock-skew/duplicate-observation handling between nodes;
- no primary-room arbitration.

**Gate:** two-node deterministic simulation, explicit handoff, simultaneous-room conflict, stale node, clock skew, reconnect, duplicate events, participant deletion, no automatic route inference.

### 13E — Recording & Recall Runtime
**Baseline: 5.4/10.**

Existing strengths:
- canonical transcript/session/meeting/ROOM timeline;
- metadata-only recording references in 12E;
- local recall/search/export;
- explicit deletion/provenance boundaries.

Missing:
- no saved-recording capture/store subsystem;
- no consent/lifecycle/retention;
- no playback index;
- no transcript ↔ recording time alignment;
- no damaged/missing media handling;
- no quota cleanup policy for media.

**Gate:** explicit owner recording start/stop; visible recording state; bounded media metadata; retention/expiry; playback reference; transcript alignment; corruption/missing-file handling; deletion; export excludes media unless explicitly requested; no background recording.

### 13F — Environmental Intelligence V2
**Baseline: 6.8/10.**

Existing strengths:
- environmental audio pipeline;
- room event ledger;
- acoustic patterns;
- ROOM temporal reasoning;
- source-direction context.

Missing:
- limited event vocabulary/calibration;
- no durable per-event confidence calibration history;
- no robust event grouping across short bursts;
- limited TV/music/door/household sound discrimination;
- no owner correction feedback contract.

**Gate:** speech-vs-room-noise, music/TV, door/impact, cough-like observable acoustic event without health inference, repeated-event grouping, source unavailable, owner correction, confidence decay, no participant identity shortcut.

### 13G — Behavioral & Routine Intelligence
**Baseline: 5.9/10.**

Existing strengths:
- bounded ROOM temporal events;
- participant presence/activity;
- session recall;
- owner memory;
- cognitive loop.

Missing:
- no explicit routine model;
- no recurrence windows;
- no baseline/deviation confidence;
- no owner approval/correction for learned routines;
- no expiry/revocation contract.

**Gate:** recurring arrival/activity windows, sparse-data abstention, changed routine, owner correction, participant deletion, bounded history, privacy labels, no protected/health inference, no silent permanent memory.

### 13H — Proactive Agent Intelligence V3
**Baseline: 7.3/10.**

Existing strengths:
- proactive governor;
- interruption budgets/cooldowns;
- quiet hours;
- participant opt-out;
- meeting/task guards;
- multimodal reasoning context.

Missing:
- limited opportunity ranking across room/routine/task/conversation evidence;
- no explicit usefulness/urgency scoring;
- weak suppression of repeated semantically equivalent prompts;
- limited follow-up planning across longer sessions.

**Gate:** useful vs noisy opportunities, participant targeting, unknown/conflict suppression, meeting/quiet-hours protection, repeated-event dedupe, task dependency, owner disable, bounded hourly budget, no identity override.

### 13I — Performance / Long-Run Device Hardening V2
**Baseline: 7.9/10.**

Existing strengths:
- bounded software queues/maps/histories;
- recovery budgets;
- page-exit invalidation;
- storage pressure handling;
- deterministic stress tests.

Missing:
- no multi-hour physical-device evidence;
- no CPU/memory/thermal/battery trend capture;
- no adaptive degradation thresholds;
- no audio/camera quality downgrade policy;
- no performance regression report integrated with certification.

**Gate:** multi-hour representative run, CPU/memory trend sampling where browser permits, frame/audio backlog thresholds, graceful downgrade, recovery, storage pressure, background/foreground, restart, no unbounded growth.

### 13J — V0.13 Release Certification
**Baseline: 6.6/10.**

Existing strengths:
- proven V0.10–V0.12 release-core pattern;
- package/PWA audit;
- deploy ZIP + SHA-256;
- direct GitHub releases;
- acceptance docs.

Missing:
- V0.13 cross-section release contract;
- representative-device certification summary;
- all 13A–13I regression inventory;
- final V0.13 artifact/release wiring.

**Gate:** all V0.13 regressions green + package/PWA audit + PHP foundation + artifact ZIP/checksum + direct release assets + explicit software/device certification scope.

## 13A implementation contract

13A must extend the existing diagnostics stack rather than add a second diagnostics application.

Required deliverables:
- pure `src/hardware-certification-core.js`;
- deterministic PASS / PARTIAL / FAIL / NOT-RUN outcome model;
- browser/OS/device metadata normalization without fingerprint-style persistence;
- capability matrix for camera, mic, channel count, permissions API, storage estimate, AudioWorklet, local model availability where observable without network probes;
- timed checkpoint model for camera, microphone, recovery and long-session exercises;
- explicit owner-entered device/environment labels;
- report schema/version;
- report redaction allowlist;
- SHA-256-compatible canonical report serialization helper;
- diagnostics UI integration;
- tests proving report excludes raw frames/audio/transcripts/embeddings;
- updated hardware acceptance documentation;
- V0.13.0 package/PWA/audit/deploy wiring.

13A software can reach 10/10 when deterministic certification logic, UI, packaging and CI are green. Actual camera/microphone PASS evidence remains dependent on the representative hardware used by the owner and must be labeled separately from software completion.

## Release rule

Every V0.13 section must reach **10/10 software delivery** before merge and before the next section begins. Representative-device exercises are evidence generated by the diagnostics system, not a substitute for deterministic software CI and not a claim that all hardware is certified.
