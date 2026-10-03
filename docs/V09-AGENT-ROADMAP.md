# Tracky2 V0.9 Agent System: architecture and acceptance roadmap

## Canonical system boundaries
- Existing browser camera/face/body pipeline is the only live visual source. Never create a parallel detector.
- Existing RoomAudioCapture, voice engine, and transcription path own live microphone data. Never automatically record or upload raw audio.
- Participant IndexedDB dialogue turns are the canonical local transcript; AGENT reply history is a separately consented local history. The Conversation tab merges these timestamped sources without double-recording a transcript.
- ROOM observation metadata is a bounded local IndexedDB store (500 rows) persisted only when explicitly enabled. Initial display is session-only, and the user can clear persisted and live observations. Server-side synchronization must remain explicit, consented, and permission-checked in a later section.
- Camera bounding box area yields a *relative perspective cue*, not physical distance. No sleep, diagnosis, exact location or isolated per-person speech is inferred from it.
- Triple Z switches AGENT camera and orb without altering camera permissions, capture, or recognition. Triple X hides/restores desktop sidebars. Mobile uses independent labelled left/right edge rails and one slide-out at a time.
- Orb visual cadence listens to supported TTS word boundaries with CSS speech animation fallback. Visual range sets the volume of a *new utterance* only. True spatial audio needs a governed audio render engine in a later release.

## Released first increment acceptance scope
1. Conversation merges enrolled, verified speaker transcripts and chronological agent replies in a messaging-like list. Unknown speakers remain unidentified; photographs are shown only for enrolled matched participants with valid local image data.
2. Four accessible tabs: Conversation, Player Activity, AGENT and ROOM. Other game modes remain two tabs.
3. ROOM shows stable participant arrivals and absences after a grace period. Stopping or losing the camera is not a person-departure event. Basic local daypart, audio lifecycle and accepted-turn metadata are factual observations with UTC timestamps.
4. Explicit opt-in ROOM persistence on the device, bounded pruning and a clear action.
5. A single shared camera keeps processing in Orb view. Orb follows a known speaker or user-selected, visible participant, otherwise the largest stable tracked person, and smoothly recenters if they disappear. Size and output volume respond conservatively to bounding-box perspective.
6. XXX, ZZZ, keyboard-ignore-typing, mobile rail open/close, outside dismiss, Escape dismiss, reduced-motion handling.
7. CI tests, audited deploy package and PHP installer regression green before release.

## Remaining work by priority (not part of this first increment)

### P0: unified durable state and privacy
- [ ] Section 1: consented two-way browser-to-PHP participant synchronization; conflict resolution, deletion, retention and encrypted sensitive fields.
- [ ] Section 2: server-backed shared event/observation schema with stable event IDs, UTC + monotonic durations, provenance, confidence, correction and pagination.
- [ ] Section 3: canonical durable conversation ledger for transcriptions and agent messages across devices with safe attribution changes and end-user deletion.
- [ ] Section 4: participant movement dwell, stationary period and posture evidence; distinguish uncertain resting from sleep and avoid health assumptions.
- [ ] Section 5: cognitive loop and governed task priority engine (observe, verify, interpret, rank allowed opportunities, execute, record outcome), interruption and quiet-hour rules.
- [ ] Section 18: complete recovery lifecycle when hardware, voice model, storage or network is unavailable.
- [ ] Section 19: granular participant consent, privacy UI, encrypted sensitive records and retention controls.

### P1: advanced approved perception and skill integration
- [ ] Section 6: optional ambient sound classification, including cough-like *acoustic* observations only with explicit opt-in and no diagnosis.
- [ ] Section 7: short-sample music identification; evaluate compatible API licensing and costs. Optional lyric *recognition* metadata, not blanket lyric recording. TV/movie identification requires corroborating signals.
- [ ] Section 8: actual approved object tracking, capture/snapshot review and safe server-side skill execution beyond the current registry.
- [ ] Section 9: authorized provider gateway for stored OpenAI/Claude/ElevenLabs credentials with budgets, policy gates, failover, TTS and secure server-side API calls.
- [ ] Section 13: multimodal evidence fusion with known-source attribution.
- [ ] Section 14: proactive conversations with participant quiet hours and deduplicated opportunities.
- [ ] Section 15: durable skill/task contracts and cancellation.
- [ ] Section 16: multi-participant dialogue and intentional ownership of the main tracked participant.

### P2: refinement and installed certification
- [ ] Section 10/12/17: explainable, corrigible longitudinal room and participant patterns with transparent opt-in memory.
- [ ] Section 20: physical hardware acceptance and measured resource/perception/latency testing on installed target device.
- [ ] True spatial/audio-distance calibration: browser speech synthesis supports initial output-volume setting but not assured mid-utterance spatial rendering.
- [ ] Live transcription correction UI and speech turn interruption controls.

## Mandatory section gates
Review actual existing implementation before adding new code. Build targeted tests first. Run relevant checks without restarting long-running suites. No next section until the current PR has green required checks and is merged. Deployment ZIP must contain every new dependency and SHA-256 sidecar. Installed camera/microphone certification must be reported separately from CI simulation.

## V0.9.1 follow-up safeguards
- Participant deletion also clears attributed room-observation metadata in the same IndexedDB transaction; automatic duplicate named recognition messages are not saved as unattributed event records.
- Cadence pulse uses additive scale without resetting ring orientation and respects the browser reduced-motion preference.
- The packaged release remains feature-scoped: live physical-distance calibration, autonomous cognitive skills, server-side event sync and hardware validation are separate future milestones.

## V0.9.2: separated voice-profile meters and ROOM ambient audit
- AGENT participant meters never visualize the shared microphone dB or generic voice activity; they show a short, fading indication from an accepted, enrolled, voice-profile-matched segment after model verification, with explicit `VERIFIED VOICE · LAST SEGMENT` labeling. This is **not live isolated per-person waveform extraction**.
- Shared microphone activity, current dB level/noise floor, and unattributed/ambiguous/rejected audio metadata reside in ROOM. A bounded 15-second rolling metadata summary records the shared audio signal, noise floor, peak and approximate VAD frame percentage, all with timestamps.
- No ambient PCM, conversation content or media recordings are stored by the ROOM audit. ROOM summaries remain session-only unless the existing Save room observations control is explicitly enabled, in which case the existing bounded local IndexedDB retention applies.
- The same canonical audio capture, voice identity and transcript engine drive both views; no duplicated mic/AI runtime. Actual per-person live isolation, detailed sound identification and raw recording require separately consented future infrastructure.
