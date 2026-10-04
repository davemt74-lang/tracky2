# Tracky2 V0.11 — Standalone Interactive Agent Intelligence

Baseline: V0.10.9, main `f86ac3ebff7d52d8e96037b3b9f8b97f2028b5cb`. **Tracky2 remains standalone for this release.** Do not add VP3 Cloud, HomeServer, remote-agent, cross-project sync, or assumptions about those systems. Reuse the existing browser camera, RoomAudioCapture microphone path, speaker model, canonical IndexedDB dialogue, ROOM ledger, participant records, local AGENT, PWA and optional self-hosted PHP/SQLite foundation.

## Audited current implementation

- `src/room-audio-engine.js` owns the canonical live room microphone PCM capture. It uses AudioWorklet where available, falls back to ScriptProcessor, adapts a room noise floor, segments speech, bounds individual segments and emits one PCM segment stream. It already fails closed on media interruption.
- `vertical-motion.js` serializes accepted room audio through one bounded queue, snapshots mature public body tracks, runs speaker embedding, conservative voice matching, body-context association, signal gating, optional local transcription, canonical dialogue persistence and AGENT handoff.
- `src/voice-core.js` separates signal confidence, voice-profile identity and body proximity. Ambiguous voice profiles stay unmatched. Camera proximity is contextual evidence only.
- `src/voice-engine.js` has a second microphone helper only for explicit Voice Profile enrollment. It is not the live room conversation microphone and must not become a competing listening path.
- `LocalTranscriptionEngine` currently transcribes completed accepted segments. It does not provide partial/streaming hypotheses or formal transcript lifecycle state.
- `agent-mode.js` consumes canonical dialogue turns, optionally queries local Ollama, otherwise uses the scripted local reply. It avoids secondary transcript persistence. Reply gating is presently a simple pending/open + 4-second guard.
- TTS deliberately suppresses RoomAudioCapture to avoid AGENT audio feeding back into the mic. Suppression currently discards speech windows, so interruption/barge-in cannot be represented as a first-class conversation state.
- `conversation-timeline.js` merges canonical participant transcript turns with AGENT/system reply history; owner transcript corrections remain canonical.
- V0.10 resilience already provides granted-only bounded sensor recovery, permission lifecycle handling, storage-pressure protection and aggregate runtime health.

## V0.11 invariants

1. **One live room microphone.** Extend `RoomAudioCapture`; do not add a second live conversation capture.
2. Voice identity, visual participant identity and speaker attribution remain separate evidence channels. A body near the microphone never proves the speaker.
3. Canonical participant transcript turns remain in IndexedDB. AGENT history must not become a second transcript authority.
4. Every listening segment/turn has an explicit lifecycle and age. Stale work must be discarded, not answered late.
5. TTS feedback suppression is mandatory. Barge-in support, when enabled, must distinguish intentional user interruption from AGENT echo and may not weaken speaker-verification rules.
6. Unknown, ambiguous and overlapping speech remain unknown/ambiguous unless the evidence supports attribution.
7. Conversation actions are bounded, cancellable, idempotent where applicable and explainable in ROOM.
8. Media/source classification and meeting intelligence are optional higher layers; neither may create a parallel microphone/transcription stack.
9. No calibrated physical-distance claim, isolated per-person live waveform, emotion/health/sleep inference or universal hardware claim without separate evidence.
10. Each section follows audit → acceptance contract → implementation → review/optimization → CI → PR → green merge → post-merge → release ZIP/SHA → checkpoint.

## Section sequence

### 11A — Conversation & Listening Engine V2
Build a formal listening/turn state machine around existing RoomAudioCapture. Add segment IDs, monotonic lifecycle, queue age/deadline, cancellation/generation handling, explicit states for listening/speech/processing/agent-speaking/interrupted/recovering, reply eligibility, bounded backpressure, and explainable listening health. Preserve TTS feedback suppression and add conservative interrupt intent without a second mic.

**Gate:** deterministic lifecycle, stale segment, cancellation, backpressure, suppression, recovery and no-duplicate-capture tests; PR/merge/release green.

### 11B — Speaker & Participant Tracking V2
Strengthen speaker↔participant evidence fusion across voice profile, body track, face identity, occlusion and re-entry. Add explicit association confidence/provenance and ambiguity transitions. Never transfer speaker identity solely because a nearby body changes.

**Gate:** multi-person handoff, occlusion, ambiguous voice, unknown visitor and identity-revocation fixtures.

### 11C — Transcription Intelligence V2
Formal transcript lifecycle: pending/partial/final/corrected, source/model revision, timing metadata, confidence where available, stale-result rejection, canonical correction provenance, session segmentation, search/export. Partial hypotheses are ephemeral unless explicitly finalized.

**Gate:** partial→final reconciliation, cancellation, correction, speaker-boundary and export privacy fixtures.

### 11D — Multi-Participant Conversation
Make group dialogue first-class: turn ownership, addressed participant vs speaker, overlap/unknown handling, agent attention target, interruption rules, group context windows and per-participant privacy/memory boundaries.

**Gate:** two/three-person deterministic conversation fixtures with overlap, handoff and unknown-speaker cases.

### 11E — Dedicated Video Meeting Runtime
A meeting mode built on 11A–11D: meeting lifecycle, participant roster, transcript timeline, decisions, notes, action items, agent participation policy, history and post-meeting summary. No second audio/transcription engine.

**Gate:** meeting start/stop/reload, roster changes, transcript correction, action-item provenance and privacy fixtures.

### 11F — Environmental / Media Audio Intelligence
Optional consented source classification layer for environmental audio. Keep source-unverified states explicit. Music/TV identification may use dedicated approved models/providers only; energy/VAD alone never identifies content or health states.

**Gate:** disabled-by-default, consent, ambiguity, false-positive and source-separation boundary tests.

### 11G — Spatial Interaction V2
Improve camera-relative conversational position, optional calibrated inputs and directional behavior. Calibration must be explicit; without it, UI remains camera-relative. Do not infer metric distance from bbox size alone.

**Gate:** coordinate/calibration provenance and uncertainty fixtures.

### 11H — Proactive Interactive Agent V2
Extend the V0.10 cognitive loop with attention, interruption budget, follow-up opportunities, conversation/task dependencies and explicit abstention. Proactivity must honor quiet hours, participant opt-out and active conversation.

**Gate:** deterministic opportunity, abstention, cooldown, cancellation and no-duplicate-action fixtures.

### 11I — Session Recall, Search & Explainability
Search canonical conversations, meetings, ROOM events, tasks, decisions and owner memory through references/provenance instead of duplicated records. Correct/revoke/delete propagation is mandatory.

**Gate:** provenance, correction/deletion, participant scoping and stale-reference fixtures.

### 11J — V0.11 Resilience & Release
Long multi-participant sessions, audio/transcription backlog budgets, model failure, sensor recovery, storage, accessibility, meeting lifecycle, privacy regression and representative-device acceptance.

**Gate:** complete software delivery gate + explicitly separate physical/device evidence.

## 11A audited gaps and acceptance contract

Current score before 11A work: **7.4/10**.

Observed strengths:
- one canonical room mic;
- local PCM and adaptive noise gate;
- bounded 18-second capture segments;
- conservative voice match + ambiguity handling;
- one canonical dialogue store;
- generation invalidation when audio stops;
- TTS suppression prevents feedback;
- runtime sensor recovery already exists.

Observed gaps:
- no reusable turn/listening state machine;
- segment IDs and queue lifecycle are implicit;
- queue is bounded by count but not by age/deadline;
- dropped queue work is silent;
- processing is serial but cancellation/late-result semantics are scattered through generation checks;
- reply eligibility is a 4-second guard rather than an explicit turn policy;
- no first-class conversation state for AGENT speaking, suppressed listening, interruption candidate or recovery;
- no deterministic backpressure policy based on age + count;
- listening health is split across several UI strings rather than one explainable projection;
- TTS suppression discards input by design, so V0.11 must add interruption semantics conservatively without allowing AGENT echo to become user speech.

11A target:
- add a pure `conversation-listening-core.js` state/queue contract;
- wrap existing segment handoff with stable segment ID, capture generation, capture/queue timestamps and deadline;
- reject stale segments before expensive speaker/transcription work and again before canonical persistence/AGENT reply;
- make queue overflow deterministic and observable in ROOM;
- expose listening state + queue/backlog/drop reason in AGENT/ROOM UI;
- centralize reply eligibility and response-cancellation policy;
- preserve current RoomAudioCapture and current speaker/transcription engines;
- keep interrupt/barge-in conservative in 11A: explicit stop/silence commands and AGENT speech cancellation policy may be recognized only from non-suppressed verified turns; full overlapping speech recognition belongs to later audio work.

## V0.11 release rule

V0.11 sections continue the V0.10 delivery discipline: score each section against its acceptance contract and keep building until the **software delivery gate** is 10/10, then PR/merge, post-merge verify and publish the deploy ZIP + SHA-256 before starting the next section. Physical camera/microphone acceptance is documented separately from CI.

No V0.11 section may introduce VP3 Cloud/HomeServer integration. That is outside this standalone release.
