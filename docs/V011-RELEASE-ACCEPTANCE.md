# Tracky2 V0.11 — Release Acceptance

V0.11 is the standalone Tracky2 interactive-agent release. This gate closes Sections 11A–11J without adding VP3 Cloud or HomeServer integration.

## Software delivery gate

The software gate is complete only when all V0.11 section regressions are green and the repository release checks pass:

- 11A conversation/listening lifecycle, bounded queue and interruption policy.
- 11B speaker/participant association, conflict, occlusion, handoff and revocation.
- 11C transcription lifecycle, correction, provenance, search/export privacy.
- 11D multi-participant turn ownership, attention and privacy boundaries.
- 11E meeting lifecycle, roster, transcript, decisions and action-item provenance.
- 11F environmental/media audio opt-in, ambiguity and source separation.
- 11G calibrated spatial interaction with explicit approximation/uncertainty.
- 11H proactive opportunities, abstention, cooldowns and interruption budget.
- 11I recall/search built live from canonical sources with deletion/revocation propagation.
- 11J resilience: backlog budgets, optional-model fallback, sensor/storage recovery, accessibility/privacy regression and package integrity.

The CI release manifest, Node validation, package audit, PWA verification and PHP foundation checks must all be green. The deploy artifact must contain the complete V0.11 runtime and this acceptance document.

## Runtime resilience boundary

Optional local model failure may degrade to the existing bounded local reply path; it must not corrupt canonical dialogue or create a release-blocking dependency. Audio/transcription backlog must remain bounded by count/age and surface drops explicitly. Sensor recovery remains permission-aware, foreground-only and bounded. Critical storage pauses optional persistence rather than deleting data or changing consent.

Meeting state must remain singular: no more than one active meeting and no impossible start/end ordering. Participant deletion, transcript correction, ROOM retraction, memory revocation and stale-reference handling remain authoritative across recall/search.

## Accessibility and privacy regression

The V0.11 UI must retain keyboard-operable native controls, labelled status regions and non-color-only provenance/status text. Release code must not add dynamic HTML injection, unpinned runtime model revisions, external script tags, new hidden media capture, a second transcript store, or a persistent recall index.

## Physical device evidence is separate

A green software gate is **not hardware certification**. Representative camera/microphone testing requires explicit physical device evidence outside CI, including permission lifecycle, recovery, long-session operation, restart integrity and storage-pressure behavior. CI must never claim that those real-device exercises occurred.

## Release target

- Product: Tracky2 standalone
- Version: V0.11.9
- Delivery: deploy ZIP + SHA-256
- Integration boundary: standalone only
