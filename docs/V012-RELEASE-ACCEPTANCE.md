# Tracky2 V0.12 — Release Acceptance

V0.12 is the standalone Tracky2 multimodal conversation-intelligence release. This gate closes Sections 12A–12J without adding VP3 Cloud, HomeServer, remote-agent, or cross-product dependencies.

## Software delivery gate

The software gate is complete only when all V0.12 section regressions are green and the repository release checks pass:

- **12A Canonical Multimodal Identity Fusion** — voice, face/body continuity, context, freshness, conflict, abstention, revocation and explainable transitions.
- **12B Shared-Microphone Diarization** — bounded one-mic speaker segmentation/clustering, unknown clusters and unresolved overlap.
- **12C Continuous Camera + Voice Fusion** — temporal camera/voice association across walking, occlusion, re-entry and sensor loss without identity transfer.
- **12D Real-Time Multi-Person Attribution** — multiple speaker candidates, overlap intervals, ownership changes, interruptions and owner correction.
- **12E Recording & Session Identity Timeline** — one canonical session identity across dialogue, ROOM, meetings and metadata-only recording references; no media duplication.
- **12F Multi-Room / Handoff Intelligence** — uncertain departure, same-room re-entry and explicit room handoffs without teleport inference.
- **12G Advanced Spatial + Audio Source Intelligence** — optional stereo direction plus calibrated visual bearing/distance, with mono/source-unavailable fallback and explicit conflicts.
- **12H Agent Multimodal Reasoning** — bounded verified evidence context, memory isolation and an explicit no-agent-identity-override rule.
- **12I Long-Session / Stress Hardening** — bounded queues/histories, participant churn/deletion reconciliation, recovery budgets, storage pressure and restart cancellation.
- **12J Release** — cross-section invariants, package/PWA/version integrity, documentation, CI, artifact and SHA-256 proof.

The CI gate must run Node tests/static checks, the release audit, PWA verification and PHP foundation/security checks. The final deploy artifact must contain the complete V0.12 runtime, V0.12 acceptance document and release-readiness core.

## Cross-section invariants

V0.12 preserves these release boundaries:

1. There is one live ROOM microphone path. Stereo is an optional capability of that same capture, not a second capture.
2. Canonical transcript authority remains singular. Diarization, multimodal fusion, spatial/audio context and AGENT reasoning annotate or consume canonical turns; they do not create a second transcript store.
3. Voice, face, body continuity, spatial context, conversation scope and temporal evidence remain distinct channels. Proximity, bounding-box size and spatial direction are never speaker identity proof.
4. Unknown/ambiguous is a valid output. Conflicting, stale, overlapping or revoked evidence is not forced into a participant identity.
5. Participant deletion/revocation propagates through persistent and transient participant-scoped state without stale resurrection.
6. AGENT may reason from canonical evidence labels but cannot create, merge, replace or override participant identity.
7. Metric spatial claims require explicit owner floor calibration. Uncalibrated spatial results remain approximate and non-metric.
8. Long-session state is bounded and cancellation/restart invalidates stale work.
9. No emotion, health, protected-trait or sleep inference is introduced.
10. Tracky2 remains standalone for V0.12.

## Runtime and privacy resilience

The shared-microphone queue is bounded by count and age, diarization windows/clusters are bounded, continuous-fusion links are capped, visual history is age/count bounded, ROOM and gameplay timelines are capped, and proactive interruption state is bounded. Sensor recovery is permission-aware, foreground-aware and budgeted. Critical browser-storage pressure pauses optional ROOM persistence rather than silently deleting unrelated canonical data.

Participant deletion removes directly attributed canonical dialogue, scrubs embedded participant references, ROOM observations, owner memory and meeting references, and also reconciles current transient AGENT/runtime state. Raw room audio, camera frames, face embeddings and voice embeddings are not added to transcript/session exports by V0.12.

## Accessibility regression

The release keeps native keyboard-operable controls, labeled status regions, visible text for uncertainty/provenance and non-color-only runtime state. The release audit rejects duplicate DOM IDs, missing referenced controls, dynamic HTML injection, unpinned model revisions, external runtime script tags and non-loopback insecure HTTP URLs.

## Physical device evidence is separate

A green V0.12 software gate is **not hardware certification** and does not prove universal camera, microphone, stereo-array, browser or multi-speaker performance. Representative physical camera/microphone/multi-speaker exercises remain separate device evidence. They should cover real permission lifecycle, mono/stereo capability, overlapping speakers, camera/voice fusion, sensor interruption/recovery, long-session operation, restart integrity and storage pressure on representative hardware.

CI and deterministic fixtures certify software contracts only; they must never claim those physical exercises occurred.

## Release target

- Product: Tracky2 standalone
- Version: **V0.12.9**
- Delivery: deploy ZIP + SHA-256
- Integration boundary: standalone only
- Hardware status: separate physical device evidence required
