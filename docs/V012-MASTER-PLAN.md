# Tracky2 V0.12 — Standalone Multimodal Conversation Intelligence

Baseline: V0.11.9, main `2cd4cda227b611fa7615019a8c3f1b42900edfc5`. **Tracky2 remains standalone for V0.12.** Do not add VP3 Cloud, HomeServer, remote-agent, or cross-product dependencies.

V0.12 closes the largest remaining interaction gap: shared-microphone multi-speaker understanding and continuous camera/voice fusion. The release must extend the existing single room microphone, canonical transcript store, participant identities, ROOM tracking, meeting runtime, recall, agent cognition, and explicit provenance rules. It must not create parallel capture, transcript, participant, or memory authorities.

## Audited V0.11 baseline

- `RoomAudioCapture` is the only live room microphone.
- `speaker-participant-core.js` performs conservative voice-first association and explicitly refuses to use a nearby body as speaker proof.
- `identity-engine.js` provides face embeddings plus body detections; `room-tracking-core.js` maintains body continuity, occlusion and re-entry.
- Canonical dialogue turns retain speaker/transcript provenance and owner correction.
- Multi-participant conversation, meeting runtime, environmental audio, calibrated spatial interaction, proactive agent behavior and session recall are already canonical layers.
- V0.11 deliberately leaves true overlapping-speaker diarization and continuous cross-modal identity fusion unresolved.

## V0.12 invariants

1. **One live room microphone.** Diarization extends the existing room-audio path; no competing live mic.
2. **Evidence channels remain distinct.** Voice, face, body continuity, calibrated spatial evidence, conversation scope and temporal continuity are inputs, not interchangeable proof.
3. **No proximity identity shortcut.** Bounding-box size, nearest visible body or apparent camera distance alone can never identify a speaker.
4. **Unknown is valid.** Weak, conflicting, overlapping or stale evidence must stay unknown/ambiguous.
5. **Canonical transcript authority remains singular.** Diarization and fusion annotate canonical turns/segments; they do not create a second transcript store.
6. **Continuous fusion is bounded and explainable.** Every identity decision has confidence, evidence, conflicts, age and abstention reason.
7. **Revocation/deletion propagates.** Removing a participant or voice/visual authority invalidates future use and prevents stale resurrection.
8. **Overlap is first-class.** Simultaneous speech may produce multiple speaker hypotheses or an explicit unresolved overlap; never force a single speaker.
9. **Sensor/model failure degrades safely.** Camera, voice model or diarization failure falls back to less-specific states without corrupting canonical history.
10. **No emotion, health, protected-trait or sleep inference.** V0.12 identity fusion is identity/turn attribution only.
11. **Physical calibration remains explicit.** Metric spatial claims require owner calibration; otherwise spatial evidence stays camera-relative.
12. Each section follows audit → acceptance contract → implementation → optimization → deterministic tests → PR → green CI → merge → post-merge verification → release artifact/checksum.

## Section sequence

### 12A — Canonical Multimodal Identity Fusion
Create one pure fusion contract over voice match, live face/body identity, track continuity, spatial evidence, conversation scope and evidence age. Add confidence bands, conflict/abstention reasons, provenance and transition semantics. Existing 11B voice-first behavior remains a valid conservative fallback.

**Gate:** verified voice+visual agreement, voice/visual conflict, duplicate visible identity, occlusion/re-entry, stale evidence, participant deletion/revocation, unknown visitor, ambiguous voice, uncalibrated spatial evidence and no-proximity-proof fixtures.

### 12B — Shared-Microphone Diarization
Add bounded speaker segmentation/clustering over accepted room PCM while preserving the one-mic rule. Represent overlap, speaker-change points, unknown clusters and model confidence explicitly.

**Gate:** one/two/three speaker deterministic fixtures, overlap, silence/noise, cluster split/merge limits, stale segment cancellation, bounded compute/backlog and no second capture path.

### 12C — Continuous Camera + Voice Fusion
Associate diarized speaker segments with current multimodal participant hypotheses over time. Use temporal windows and track continuity; recover across occlusion and re-entry without transferring identity between bodies.

**Gate:** walking participant, cross-path, occlusion, camera loss, voice-only interval, visual-only interval, re-entry, two visible candidates and unknown speaker fixtures.

### 12D — Real-Time Multi-Person Attribution
Make canonical turns support multiple speaker candidates/overlap intervals, turn ownership changes, interruptions and corrections while preserving single-turn provenance.

**Gate:** overlapping speech, interrupted turns, speaker handoff, partial attribution, owner correction and transcript export/privacy fixtures.

### 12E — Recording & Session Identity Timeline
Unify recordings, transcript turns, meetings, ROOM events and participant references through one canonical session identity timeline. No media duplication.

**Gate:** session start/stop/reload, corrected identity, deleted participant, meeting linkage, stale references and export-boundary fixtures.

### 12F — Multi-Room / Handoff Intelligence
Represent participant departure, re-entry and explicit room transitions without duplicating participant identities or inventing unseen movement.

**Gate:** leave/re-enter, uncertain departure, room transition, stale track, simultaneous rooms and no-teleport inference fixtures.

### 12G — Advanced Spatial + Audio Source Intelligence
Combine explicit floor calibration with optional audio-direction/source evidence when available. Uncalibrated systems remain approximate and non-metric.

**Gate:** calibrated/uncalibrated, mirrored camera, direction uncertainty, conflicting spatial/audio cues and source-unavailable fixtures.

### 12H — Agent Multimodal Reasoning
Give AGENT access to verified multimodal identity/turn context with evidence labels, abstention and privacy boundaries. Agent reasoning may reference fusion evidence but may not override canonical identity decisions.

**Gate:** verified/unknown speaker behavior, conflicting evidence, memory isolation, meeting context, proactive interruption and no-agent-identity-override fixtures.

### 12I — Long-Session / Stress Hardening
Stress shared-mic diarization, camera/voice fusion, participant churn, model failure, sensor recovery, queue pressure, storage and restart integrity.

**Gate:** deterministic long-session simulation, bounded memory/queues, recovery, cancellation, deletion propagation and accessibility/privacy regression.

### 12J — V0.12 Release
Close the complete V0.12 software delivery gate, package/PWA/version integrity, documentation, post-merge verification and deploy ZIP/SHA-256. Physical camera/microphone/multi-speaker exercises remain separate device evidence.

**Gate:** all V0.12 regressions green + package audit + PHP foundation + artifact verification; explicitly no universal hardware claim.

## 12A audited gap and acceptance contract

Baseline score: **7.6/10**.

Strengths already present:
- conservative voice-profile matching;
- explicit voice/visual conflict state;
- face/body identity and body continuity;
- occlusion/re-entry state;
- duplicate visual-track protection;
- association provenance on canonical turns;
- participant deletion/revocation behavior;
- explicit unknown/ambiguous states.

Missing for 12A:
- no single reusable evidence object across all modalities;
- no evidence age/freshness contract;
- confidence is mostly inherited from voice similarity rather than fused conservatively;
- no normalized conflict severity/abstention reason;
- no explicit distinction between identity authority and contextual evidence;
- no reusable transition contract for later diarized speaker hypotheses;
- spatial/conversation context is not yet represented in the same evidence envelope;
- no cross-modal decision trace that later 12B/12C can consume deterministically.

12A target:
- add pure `multimodal-identity-core.js`;
- normalize voice, visual, track, spatial and conversation evidence with timestamps and authority classes;
- compute conservative fusion state/confidence with hard conflict and stale-evidence abstention;
- preserve 11B voice-first verified identity unless stronger contradictory authoritative evidence exists;
- treat spatial/conversation evidence as context only, never identity proof;
- expose bounded provenance, conflicts and abstention reasons;
- add deterministic transition tracking for verified ↔ ambiguous ↔ unknown ↔ revoked states;
- integrate fields additively into canonical speaker association/turn provenance;
- no new storage, camera, microphone, model download or network path.

## Release rule

Every V0.12 section must reach **10/10 software delivery** before merge and before the next section begins. Physical multi-speaker/device acceptance remains separate from CI.
