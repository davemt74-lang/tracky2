# Tracky2 V0.6.3 — Complete Face Enrollment Gallery

The participant page now shows **five gallery positions**, with a clear minimum of three actual recognition samples. The first primary capture automatically creates sample 1; Capture sample adds samples 2–5 and retains each new photo alongside its descriptor. Gallery actions allow selecting any stored sample as primary, retaking one sample (replacing its photo and recognition descriptor together) and removing individual samples. Removing samples updates readiness immediately; recognition cannot be enabled with fewer than three. Existing enrolled participants keep every historical descriptor; older samples without stored photos display honest placeholders until retaken. All images and biometric descriptors stay in the existing browser-local participant database. Face reticles now map normalized detector coordinates to the mirrored `object-fit: cover` camera preview, including off-center cropping, with restrained small-jitter smoothing. Installable PWA assets and cache are bumped to V0.6.3.

# Direct deployment download

Install from the GitHub **v0.6.2 release assets**, not the GitHub Actions artifact download. The release provides the standalone `tracky2-v0.6.2-deploy.zip` and `tracky2-v0.6.2-deploy.zip.sha256` as two separate files, avoiding Actions' automatic ZIP wrapper. CI still retains its Actions artifact as a build backup.

# Tracky2 V0.6.2 — Reaction Challenge
The game lobby includes a second game, **Reaction Challenge**, alongside Random Follow Pattern and the classic games. Choose 1–6 enrolled participants, 30/60/90/120-second turns and 5/10/15/20 rounds on the existing shared four-section board. Move your current marker **outside** a randomly highlighted section and then into it to record a timed hit. Results count hits, incorrect-zone transitions, accuracy and best/average response time per player. The board changes turns only when an interval expires. For larger groups the same green marker must be passed manually; face/voice recognition is not proof of marker ownership. The updated PWA pre-caches the new game's source, but actual camera and optional recognition hardware still require device testing.

# Tracky2 V0.6.1 — Installable PWA

Tracky2 now ships a manifest and branded 192/512px maskable app icons, with an install prompt on supported browsers, offline same-origin app shell and user-controlled update notices. Camera and microphone still require localhost/HTTPS and permission. AI model and voice downloads are NOT guaranteed offline until their separate optional model packages are explicitly installed; do not treat cached UI as full recognition offline. Service-worker updates never clear IndexedDB or local participant data and wait for the user to finish any running camera/game before applying.

# Tracky2 V0.6.0 — Splash screen and launch shell

The app launches from `index.html` with branded Tracky2 splash, device-readiness notes and an always-available entrance to the game lobby. The first visit in a tab transitions to Games after a short animation unless Stay on splash is selected; reduced-motion preference disables automatic transition. Camera and voice access are never requested by the launcher. Existing tracker setup lives at `tracker.html`; all other game and participant pages remain intact.

# Tracky2 V0.5.1 — Game lobby and expanded player roster

Open **Games** for a full setup screen with enrolled participant selection, player order, interval length, total rounds and an exact round-by-round preview. Random Follow Pattern now supports 1–6 selected participants on the original shared four-zone board. One player uses green; two use separate green/blue markers; groups of 3–6 manually pass one green marker when the timer changes turns. Select at least as many total rounds as players (six players require 10/15/20 rounds). The one-time same-tab lobby transfer contains only enrollment IDs and game settings, checks enrollment again on the game page and never activates the camera automatically. Classic solo and two-player games remain selectable. This section does not claim live hardware certification or automatic identification of a shared marker holder.

# Tracky2 V0.5.0 — Random Follow Pattern game platform

**Game 01: Random Follow Pattern.** From Games, launch the shared four-zone gameboard, select **one or two** locally enrolled participants and choose a **30-, 60-, 90-, or 120-second interval** plus **5, 10, 15, or 20 total timed rounds**. Each interval is one round. Green starts; if two players are selected, the shared board switches to blue on the next timed round, then alternates. During a round, a random highlighted zone calls for **3–6 up/down reps**. Each completed target earns a point and immediately draws another non-repeating random zone/repetition target. Only the active controller scores. The classic solo and two-player point-goal modes remain accessible from Game mode.

The new DOM-free game registry, reusable shared board, explicit player binding and independent timed engine are described in `docs/GAME-PLATFORM.md`. Existing participant/body tracking, opt-in voice profiles, calibration and hardware self-tests remain available. New pattern scores are session-only in this first section; physical hardware certification is still pending.

# Tracky2 V0.4E — On-device hardware self-test

Visit **diagnostics.html** (or choose **Hardware self-test** on the Vertical Motion page) from localhost or HTTPS. Start the camera and move both green and blue markers through all four board sections while the diagnostics page is visible for at least eight seconds. The page measures camera FPS, per-marker detection confidence, stable observations, rejected jumps, tracking dropouts and zone coverage. Start the optional microphone test and speak normally to verify signal capture without recording audio. Export the aggregate JSON report locally to review or share for device certification. No media or biometric data is included in the report.

The hardware self-test does not itself certify face recognition, body lock after turn-away, Voice Profile identification or full gameplay. Follow the checklist in diagnostics.html to verify those interactively on your devices. A green CI result proves software regression and deployment integrity, **not** actual device performance.

# Tracky2 V0.4D — Optional match history

Select two enrolled participants and opt in to **Save scores and match progress locally** before starting a match. After completion or an early stop, Tracky2 stores only match identifiers, dates, completion state and each participant's points and completed rounds on this device. The history view shows recent matches and per-player progress, supports clearing saved results and automatically purges a participant's entries when that local profile is deleted. Up to 100 sessions are retained; no camera or microphone recordings, biometric embeddings or dialogue are written to match history. Opt-in defaults to off each page visit.

# Tracky2 V0.4C — Participant, voice and controller visibility

The two player scorecards now display current participant face/body tracking (including temporary occlusion), Voice Profile readiness, and whether the manually assigned color marker is near the player's tracked body. Marker proximity is **advisory only**: when two bodies overlap, neither person's hand position nor identity is inferred. Existing opt-in face/voice enrollment and the independent scoring assignments remain unchanged. No images or audio are saved by these indicators.

# Tracky2 V0.4B — Stable marker acquisition

Each shared-board turn now requires three consecutive coherent camera observations before the active marker can score. If tracking drops out or an implausible position jump appears, the incomplete repetition is discarded and the marker is reacquired. Turning the shared board green or blue also clears the previous tracking lock. The arena displays the current acquisition or recovery state. This safety gate does not change participant recognition or voice profiles; live camera/hardware testing remains necessary.

# Tracky2 V0.4A — Shared four-section turn-based multiplayer

Both enrolled participants use **one shared four-section board**, not separate lanes. Green starts. Every completed round (one point) hands control to blue, and the board highlight and cursor change to the active player's marker color. Each participant keeps their own score, round target and movement telemetry; inactive markers cannot score. Once one player reaches the selected point goal, the other finishes their remaining rounds. The original three-zone solo game is unchanged.

Before playing, use the camera calibration controls to choose Normal, Low light or Bright conditions, optionally adjust marker hue and saturation and minimum marker area, and inspect both marker confidence indicators. Apply and save stores only the detection settings in local browser storage. Enrolled participant recognition and optional Voice Profiles remain independent; manual marker assignment does not prove the holder's identity. On-device testing remains required.

# Tracky2 V0.3 — Two-player Vertical Motion

Choose **Two-player** in Vertical Motion, assign two different locally enrolled participants to green and blue physical markers, and press **Start match**. Each color runs its own independent movement detector, score, target and travel metrics. Both participants complete their own challenges. The original solo mode remains available. Existing participant recognition, full-body tracking, local Voice Profiles and optional transcription are unchanged.

**Attribution notice:** Marker assignment is manual, not biometric proof of who holds the object. On-device camera and microphone testing is still required, especially under challenging lighting. `npm run validate` is the CI acceptance gate.

# Tracky2 V0.2 — Modular game runtime

Game lifecycle and frame scoring now run in `src/game-session.js`, independently of camera, participant and voice implementations. `src/game-input.js` converts raw green-object detections to normalized samples. `src/game-presenter.js` produces the existing game instructions without DOM access. Original participant/body/voice systems remain intact. Missing tracking resets incomplete repetitions to prevent phantom scoring; stale and invalid frames cannot score. This is still one-controller gameplay; multiplayer player assignment is a later section.

**Validate:** `npm run validate`. CI publishes a standalone ZIP and checksum. Camera and microphone integration still require on-device testing.

# Tracky2 — Gameplay recovery

Independent game-focused recovery of original Tracky V0.7 from PR #9 (`a8ed0c134b0bb2b77ed596828d564d9d4de9cf9b`). Features include the original Vertical Motion game, multi-person tracking, local participant enrollment and voice profiles. No HomeServer, Cloud or Agent Eyes dependency. Current gameplay uses one green-object controller and one score; player-specific multiplayer scoring is a subsequent milestone.

Run `npm run serve` and open `/games.html` on localhost. Use `/participants.html` for enrollment. `npm run validate` runs original unit, syntax and audit checks. Camera and microphone require secure context (localhost or HTTPS). Some local AI models need an initial download.

---

# Tracky

Tracky turns real-world movement into browser-game input.

## V0.7 — Codebase Hardening & Release Quality

V0.7 is a full audit/hardening release. It does not change the game concept; it makes the camera, identity, Voice Profile, dialogue, privacy, performance, and release paths safer and more deterministic.

### Identity correctness

- Face matching requires a complete multi-sample profile and a clear margin over the second-best participant
- Face and Voice Profile matching use robust multi-sample similarity instead of trusting one outlier enrollment sample
- Voice Profile matching ignores incomplete profiles
- Voice enrollment rejects samples that are too noisy, contain too little sustained speech, or conflict with the participant's existing Voice Profile
- One participant cannot remain assigned to two live body tracks after reacquisition
- Occluded/stale body positions are excluded from conversation-proximity grouping
- Speech turns capture a room/body snapshot at the time the speech occurred so later movement does not rewrite transcript context

### Audio/runtime hardening

- Room audio uses AudioWorklet as the primary PCM path with ScriptProcessor only as a compatibility fallback
- AudioWorklet PCM messages are batched to reduce cross-thread overhead
- JARVIS spoken acknowledgements temporarily suppress room capture so Tracky does not transcribe itself
- A safety timer releases microphone suppression if browser speech events fail
- In-flight speech analysis is invalidated when audio is stopped or dialogue is cleared
- Browser capability checks fail cleanly when camera, microphone, MediaRecorder, Web Audio, or OfflineAudioContext are unavailable
- WavLM, Whisper, Human, and browser library versions/revisions are pinned in one model configuration module

### Privacy and lifecycle

- Pending face-capture handoffs expire automatically after 24 hours
- Saved dialogue history is bounded to the most recent 500 turns
- Deleting a participant removes their attributed dialogue and scrubs their nearby-participant references
- The game can reload recent locally saved dialogue and provides a Clear saved dialogue control
- Voice Profile recordings remain ephemeral; only speaker embeddings and quality metadata are stored
- Switching participant profiles during voice enrollment cancels and discards the active sample instead of risking cross-profile assignment

### Performance and maintainability

- Camera/tracking canvases are resized only when dimensions actually change rather than reallocating every frame
- The core tracker runtime was expanded from compressed source into maintainable functions
- The calibration polling timer was removed; capture readiness now updates in the render loop
- Runtime DOM updates use safe node construction/textContent instead of dynamic innerHTML

### Release-quality CI

V0.7 adds a repository audit that fails CI for:

- missing deploy/runtime files
- broken relative imports
- missing HTML elements referenced by JavaScript
- duplicate HTML IDs
- external script tags
- unsafe runtime DOM/eval patterns
- obsolete voice-clone terminology
- moving/unpinned model revisions
- missing AudioWorklet/fallback paths
- incomplete V0.7 deploy manifests

The CI gate runs the complete unit suite, JavaScript syntax checks, the repository audit, deploy-ZIP construction, ZIP integrity verification, and SHA-256 generation.

## V0.6 — Voice Profiles + Spatial Dialogue

V0.6 adds participant-specific Voice Profiles and combines them with full-body room tracking for conservative speaker attribution and transcription.

### Voice Profiles

- Each saved participant can capture multiple clean speech samples
- Tracky converts those samples into local WavLM speaker embeddings
- A Voice Profile becomes ready after at least 3 redundant samples and 15 seconds of captured speech
- Enrollment recordings are discarded after processing; Tracky keeps speaker embeddings and sample-quality metadata
- Voice Profile matching is independent from face matching
- Ambiguous matches are rejected when the two best enrolled speakers are too close in confidence
- Voice Profile recognition can be disabled per participant

### Multi-signal room audio

Room audio uses several independent filters and identity signals instead of trusting one detector:

1. browser echo cancellation and microphone noise suppression
2. speech-band high-pass / low-pass filtering
3. adaptive room noise-floor estimation
4. voice activity detection
5. minimum speech-turn duration
6. Voice Profile match confidence
7. face identity when visible
8. persistent body identity when the face is not visible
9. body proximity for conversation grouping
10. transcript confidence gating

Background/noise-only and ambiguous-speaker segments are rejected instead of being assigned to a participant.

### Spatial dialogue + transcription

- Enable room audio from the Vertical Motion game
- Live JARVIS HUD shows mic dB, adaptive noise floor, VAD state, Voice Profile model state, current speaker, match confidence, body lock, and dialogue group
- Participant cards show Voice Profile readiness, recent speaker confirmation, body lock, and conversation group
- Nearby tracked bodies are grouped into dialogue groups such as `G01`
- Unknown tracked bodies can still appear in proximity context using their Track ID
- Accepted speech turns can be transcribed locally with browser Whisper
- Transcript turns record speaker, body track, dialogue group, nearby participants, Voice Profile confidence, signal confidence, and transcript
- Dialogue turns are persisted locally in IndexedDB

### Participant acknowledgement

Tracky now explicitly acknowledges room arrivals:

- a stable unknown body track produces a **New participant tracked** event
- a later face match produces a **Participant recognized** event
- JARVIS room events appear in the transcript HUD
- optional browser speech synthesis can speak these acknowledgements

### Local models

- Speaker identity: `Xenova/wavlm-base-plus-sv`
- English transcription: `Xenova/whisper-tiny.en`
- Both execute in the browser through Transformers.js and are loaded lazily
- Initial model download requires network access; browser caching is enabled

## V0.5 — Full-Body Room Persistence

V0.5 upgrades participant identity from face-only tracking to persistent person/body tracking.

### Persistent room tracking

- Detect multiple full bodies in the camera view
- Bind a recognized face to the corresponding body track
- Keep the participant identity attached when the person turns their face away
- Maintain per-person room Track IDs such as `T001`, `T002`, and `T003`
- Predict short-term motion to reduce ID swaps when participants cross paths
- Use body-box overlap and body-size consistency when associating frames
- Preserve an identified track through brief occlusion for up to about 6 seconds
- Reconnect the participant when the same body track becomes visible again
- Fall back to an estimated body region when a usable face is visible but the body detector misses
- Keep face recognition as the identity authority; body tracking preserves an already-established identity rather than identifying someone from their body alone

### Futuristic room radar

The live game HUD now includes a room map showing the normalized position of every active body track.

- cyan dot: unknown person/body track
- green dot: identified participant
- faded/dashed dot: participant temporarily occluded
- labels show participant name or Track ID
- cards transition between **FACE + BODY LOCK**, **BODY LOCK**, **OCCLUSION MEMORY**, and reacquisition states

### Identity limits

Body tracking preserves identity while a participant remains continuously trackable or is only briefly occluded. If someone leaves the camera view long enough for the body track to expire and later returns with no usable face visible, Tracky does not guess who they are; it waits for a face match before restoring identity.

## V0.4 — Futuristic UI + Participants & Identity

V0.4 adds a local-first participant identity layer and redesigns Tracky as a futuristic room/game HUD.

### Live room identity

- Detect multiple faces in the same camera view
- Upper-right participant cards on the game screen
- Live face-quality and scan-progress states
- Match only against participants explicitly enrolled on the current device
- Unknown people remain unidentified until a participant is created
- Save a fresh current face capture after a successful match
- Display both the saved primary photo and the current capture
- Promote the latest capture to the participant's primary photo
- Reject an incorrect match with **Not this person**
- Send an unknown live capture directly into participant onboarding

### Participant roster and onboarding

- Dedicated `participants.html` contact / participant list
- Create, edit, and delete participant profiles
- Camera-based **Capture / replace primary photo**
- Separate current/latest photo
- 3–5 local face-enrollment samples
- Face descriptors and profile photos stored in browser IndexedDB on the device

### Recognition engine

Tracky uses the browser build of `@vladmandic/human@3.3.6` for face descriptions and full-body detection.

- Inference runs in the browser
- Pretrained model files are loaded from jsDelivr and may be cached by the browser
- Initial model loading requires network access
- Tracky does not query an outside identity database
- Recognition compares current face descriptors only with participants enrolled on this device
- Movement/game tracking remains usable if the identity model cannot load

## V0.3 — Vertical Motion gameplay

- Choose a point goal from 1–50
- Highlight one of three lane sections
- Assign a random 4–10 rep target
- One upward leg followed by one downward leg counts as one repetition
- Clearing the section scores 1 point
- Reaching the selected point goal ends the game
- High-volume micro-movement analytics continue independently

## V0.2 — Games + Vertical Motion

- Games library
- 1 inch × 5 inch vertical lane
- Three equal tracking zones
- High-volume frame-by-frame vertical movement
- Overall and per-zone analytics

## V0.1 — Camera Tracking Core

- Browser webcam capture
- HSV green-object tracking
- Smoothed game cursor
- Tracking telemetry
- Four-point calibration

## Run locally

Camera access requires localhost or HTTPS.

```bash
python -m http.server 8080
```

Open:

- `http://localhost:8080/games.html` for games
- `http://localhost:8080/participants.html` for participant onboarding

## Tests

```bash
npm test
```

No npm install is required for the Tracky application itself.
