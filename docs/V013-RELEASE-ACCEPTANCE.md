# Tracky2 V0.13 — Release Acceptance

V0.13 is the standalone Tracky2 Real-World Agent Intelligence & Reliability release. It closes Sections 13A–13J while preserving the V0.12 authority, privacy, deletion, uncertainty, and standalone-product boundaries.

## Software delivery gate

The V0.13 software gate is complete only when every section regression is green and the repository release checks pass:

- 13A Representative Hardware Certification — representative-device PASS / PARTIAL / FAIL / NOT-RUN reports, bounded capability metadata, redacted export, local SHA-256, and explicit non-universal scope.
- 13B Overlapping-Speaker Source Separation V2 — bounded optional separation from the existing shared microphone, explicit quality thresholds, abstention/fallback, no second microphone, and no second transcript authority.
- 13C Advanced Participant Continuity — conservative long-gap/occlusion/appearance-change continuity, duplicate protection, owner correction, and deletion/revocation propagation.
- 13D Multi-Room Runtime V2 — multiple room/node evidence, health/reconnect/clock-skew handling, duplicate suppression, explicit handoff, and no teleport inference.
- 13E Recording & Recall Runtime — explicit owner recording consent/start/stop, visible state, bounded index/retention, playback references, transcript alignment, missing/corrupt media handling, and deletion.
- 13F Environmental Intelligence V2 — bounded observable acoustic/event intelligence, event grouping/confidence/correction, and no participant identity or health-inference shortcuts.
- 13G Behavioral & Routine Intelligence — bounded recurrence/deviation models with sparse-data abstention, owner correction, expiry/revocation, and no silent permanent memory.
- 13H Proactive Agent Intelligence V3 — usefulness/urgency ranking, semantic-repeat suppression, bounded follow-up planning, and all prior participant/meeting/quiet-hours/interruption gates.
- 13I Performance / Long-Run Device Hardening V2 — bounded performance trends, graceful optional-work degradation, hysteretic recovery, representative two-hour evidence, and no disabling of canonical camera/mic/transcript/recording/identity authority.
- 13J Release Certification — cross-section invariants, regression inventory, package/PWA/version integrity, acceptance documentation, CI, deploy ZIP, SHA-256, and direct release assets.

The required CI gate includes Node tests/static checks, the release audit, PWA verification, and PHP foundation/security checks.

## Cross-section invariants

1. One live ROOM microphone remains authoritative. Source separation and directional audio are optional processing on that same capture.
2. One canonical transcript authority remains authoritative. Separation, diarization, continuity, room, recording, environmental, routine, proactive, and performance systems do not create competing transcript histories.
3. No hidden recording. Recording requires explicit owner consent/start, visible state, bounded lifecycle, retention, and deletion.
4. No identity shortcut. Spatial direction, source separation, body continuity, routine evidence, environmental events, or AGENT reasoning alone cannot create or override participant identity.
5. Unknown, conflict, and abstention remain valid outputs. Degraded evidence must fail less-specific, not more-confident.
6. No teleport inference. Cross-room routes remain unknown without explicit/canonical handoff evidence.
7. Participant deletion/revocation propagates through persistent and transient participant-scoped references.
8. Representative hardware evidence is configuration-specific. A PASS on one browser/device/environment is not universal hardware certification.
9. No emotion, protected-trait, diagnosis, or health inference is introduced.
10. Long-run state remains bounded across queues, source windows, continuity maps, room-node events, recording indexes, routine rows, proactive queues, performance samples, and certification events.
11. Performance degradation may reduce optional work only. Camera, microphone, transcription, recording consent, and identity authority remain intact.
12. Tracky2 remains standalone for V0.13.

## Representative-device certification scope

The diagnostics workflow can produce a local representative-device certification report and SHA-256. That report may include coarse browser/OS capability metadata, owner-entered descriptive device/environment labels, aggregate camera/microphone/runtime metrics, bounded evidence events, required exercise outcomes, and performance summaries.

It must not include raw camera frames, raw audio, transcripts, face embeddings, voice embeddings, device IDs, group IDs, raw user-agent strings, exact CPU model, or exact hardware fingerprint.

A V0.13 software-ready release may exist without a representative hardware PASS report. Software readiness proves deterministic repository contracts; hardware certification proves only the tested representative configuration.

A representative-device PASS is not universal hardware certification.

## Recording and privacy acceptance

Recording behavior remains explicit and visible. Recording media is not silently added to transcript/session exports. Missing, expired, corrupt, or deleted recording media must be reported as unavailable rather than reconstructed. Participant deletion and recording deletion/retention rules remain authoritative.

## Overlap and source-separation acceptance

Separated PCM is transient processing input only. Canonical persisted/exported records may contain bounded source-separation state, quality, direction, and verified participant-candidate metadata, but must not contain separated PCM buffers. Failed, weak, mono, or unsupported separation falls back to the existing unresolved-overlap path.

## Environmental, routine, and proactive acceptance

Environmental and routine systems may create bounded observable-event and pattern metadata with confidence/provenance. They cannot silently turn observations into permanent participant identity or owner memory. Proactive behavior remains governed by interruption budgets, quiet hours, participant opt-out, meeting/task state, canonical identity evidence, and semantic-repeat suppression.

## Performance and long-run acceptance

Representative long-run evidence may include aggregate frame/scan latency, queue depth, storage ratio, optional heap ratio, optional battery level, degradation count, and duration. Unsupported browser metrics remain unavailable. The runtime may reduce optional work under load but preserves canonical sensor, recording, transcript, and identity authorities.

## Accessibility regression

The release keeps keyboard-operable controls, labeled status regions, visible uncertainty/provenance, non-color-only state, and explicit recording/certification controls. The release audit continues to reject duplicate DOM IDs, broken control references, dynamic HTML injection, unpinned model revisions, external runtime scripts, and non-loopback insecure HTTP URLs.

## Release target

- Product: Tracky2 standalone
- Version: V0.13.9
- Delivery: deploy ZIP + SHA-256 + direct GitHub release assets
- V0.13 sections: 13A–13J
- Software status: requires green Node/package/PWA + PHP foundation/security
- Hardware status: representative-device evidence is separate and configuration-specific
- Universal hardware certification: not claimed
