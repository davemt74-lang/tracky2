# Tracky2 — Gameplay roadmap

## Restored baseline
Original Tracky V0.7, PR #9 merged commit a8ed0c134b0bb2b77ed596828d564d9d4de9cf9b. Preserve Vertical Motion gameplay, green-object tracking, calibration, raw movement analytics, local enrolled participant recognition, persistent full-body tracking, voice profiles and optional transcription. Keep this independent of Agent Eyes and VP3 Cloud.

## V0.2 modularization
- Game lifecycle, scoring dispatch, signal loss and bounded gameplay events are isolated from browser UI and participant/voice engines.
- Raw color-camera adapter and pure UI presenter can be reused independently. The original single-controller rules remain unchanged except that tracking loss resets partial reps.
- The original participant and voice engines remain separate modules; the large browser integration controller will be decomposed incrementally after hardware verification.
- This release does not claim multiplayer or hardware certification.

## V0.3: Two-player color-controller arena
- Manual selection of two distinct locally enrolled participants; green and blue physical controller markers.
- One shared camera frame processed in a single HSV pass; separate per-color detection, loss recovery, score and motion distance.
- Independent simultaneous sessions: each player completes the same target independently. The match ends when both finish.
- Original solo green-controller game remains available. Room identification and optional voice/transcription continue independently.
- Assignments designate the credited player; neither the object color nor proximity proves who physically holds it. On-device calibration, identity and low-light testing remain required.

## V0.4A — Shared board and camera calibration
- One physical four-zone board for both players. Completing a round passes the board to the next player and updates the highlight to the active marker color.
- Only the active marker can score. Players keep independent sessions, unfinished targets, turn numbers and movement measurements. Completed players are skipped until both finish.
- Camera calibration includes lighting presets, tuneable per-color hue/saturation, minimum marker area, live confidence, optional local-device persistence and reset; no video or biometric data is saved.
- Solo mode retains the original three-zone lane, and face/body/voice systems remain independently available.
- Hardware/camera certification and calibration accuracy across lighting conditions are still pending.

## V0.4B — Marker-stability runtime
- Active player scoring requires three stable observations of that player’s assigned color. A lost/noisy marker invalidates partial reps immediately and requires reacquisition; physically implausible jumps are rejected.
- Each new turn resets the stability lock so an inactive marker cannot carry a detection into the next turn. The arena displays acquisition and recovery states.
- Camera tuning remains local; automatic marker recognition is not proof of participant identity. On-device lighting and occlusion certification is still pending.

## V0.4C — Participant and voice-profile presence in game
- Scorecards show current face/body tracking, temporary occlusion and locally enrolled Voice Profile readiness for their manually assigned participants.
- Raw marker position can show non-authoritative proximity to a recognized body; ambiguous and stale results explicitly decline verification. Proximity or a voice/face match never auto-reassigns the scoring marker.
- The visual evidence adapter stores no photos, recordings or speaker embeddings. Hardware certification is still pending.

## V0.4D — Local player progress and match history
- Opt-in checkbox for saving match completion or early-stop results to local browser storage; default is off. Summary records whitelist ID, timestamps, completion flag, per-player color, points and completed rounds only.
- Retain at most 100 local matches, deduplicate session IDs, display recent match results and individual aggregated progress, allow clearing local history. Deleting a participant removes their history entries while preserving unrelated player results.
- Camera frames, face descriptions, voice samples, dialogue and raw motion traces are excluded. Physical certification remains pending.

## V0.4E — Integrated on-device release self-test
- Built-in diagnostics.html exercises browser camera and both marker detectors, shared four-zone coverage, real sample FPS and stable tracking/dropout/jump observations. Independent microphone test measures RMS only for a short, user-initiated session.
- Measurements can be exported locally as JSON without raw camera frames, recorded audio, face/voice embeddings or transcripts. The diagnostics tool gives a repeatable hardware-validation checklist for enrolled identity/body lock, Voice Profile enrollment and manual in-game turn testing.
- The automated CI gate validates the diagnostic core and complete deploy artifact. Hardware certification is explicitly NOT complete until a human runs the report on representative physical devices and verifies all manual items.

## V0.5 Section 1 — Extensible game platform and Random Follow Pattern
- Register games in a DOM-free platform. Four-zone board presentation is a reusable component shared by both Random Follow Pattern and the existing classic two-player game. Camera, identity, participant and voice runtimes stay in the host.
- First game: Random Follow Pattern. Select one or two distinct locally enrolled participants (current physical markers: green and blue), intervals of 30/60/90/120 seconds, and 5/10/15/20 timed rounds per game. Each interval is one round; players alternate each round (for an odd round count the starting player receives one extra round). Only the current player may score.
- During a round, random non-repeating zone targets require 3–6 complete up/down repetitions; completing a target awards one point and immediately generates another target until time expires. Timed round boundaries are independent of frame delivery and late inputs cannot award extra attempts; background-tab clock gaps consume elapsed rounds.
- Original classic solo and point-goal multiplayer remain selectable. Pattern session results are volatile in Section 1; historical persistence can be extended explicitly in a later section. Physical camera/voice hardware certification remains pending.

## V0.5 Section 2 — Game selection and expanded player lobby
- New game lobby selects Random Follow Pattern or existing classic solo/two-player modes. Timed-game lobby loads locally enrolled participants and previews duration and exact round-by-round roster order.
- Timed Random Follow Pattern supports 1–6 unique enrolled participants. Two players retain separate green/blue markers; a group of 3–6 manually passes one green marker when the round expires. Camera, face/body and voice systems remain shared and do not automatically attribute marker ownership.
- Require enough rounds for every selected participant to play once. Use a one-time sessionStorage handoff containing enrollment IDs and settings only (no names, photos, embeddings or voice data), never participant IDs in URL parameters; revalidate against current enrollment before game setup. No automatic camera or game start.
- Extend shared-board UI with dynamic group scoreboard for 3–6 players and keep classic modes functional. Live hardware acceptance for shared-marker multi-person handoffs remains pending.

## Acceptance gates
1. Recover all baseline files, V0.7 unit tests, syntax and repository audit. Produce integrity-checked deploy ZIP in CI.
2. Certify actual camera tracking, calibration, identity matching, body occlusion and mic enrollment on supported browser hardware. CI alone cannot establish hardware readiness.
3. Separate reusable game/session state, tracking input, identity, voice and UI without regressing original play.
4. Add explicit player-to-controller assignments, individual scoring and multiplayer games. Original V0.7 observes multiple people but scores only one green-object controller; do not claim otherwise.
5. Add more camera-controlled games and player-specific progress and analytics.

## Privacy and licensing
Recognition must be opt-in. Preserve local storage, raw voice enrollment audio deletion, ambiguity rejection and participant deletion; provide visible camera/mic stop controls. Review original CDN AI dependencies and model licenses prior to public production release. Unknown people should remain anonymous.

## Source map
Original PRs #1–#5 supply game tracking and play. PR #6 supplies participant recognition. PR #7 supplies body persistence. PR #8 supplies local voice identities. PR #9 supplies hardening, testing and packaging. PR #10 may inform an optional game event bus, but its Agent Eyes/Cloud runtime is excluded.

Next development phase starts only once this PR is green and merged.

## V0.6 Section 1 — Branded splash and application shell
- New branded splash launches to the game lobby on first visit in each browser tab with a safe automatic transition. An always-available Enter game lobby link and Stay on splash control prevent traps, and reduced-motion preferences are respected.
- Existing camera-tracker setup moves from index.html to tracker.html with game and diagnostic navigation updated, preserving all original tracker controls and avoiding camera permission prompts during startup.
- Browser readiness checks are informational; data/face/voice enrollment remains local and opt-in. Desktop/mobile responsive shell includes game lobby, participants, tracker setup and hardware testing.

## V0.6 Section 2 — Installable PWA
- Branded app manifest with PNG 192/512 maskable icons, SVG mark and standalone installation.
- Versioned static same-origin cache powers launcher, games, tracker, participants and diagnostics offline after successful installation. Explicitly exclude cross-origin recognition/voice model downloads and personal data.
- Only offer updates after the user stops active camera/game; preserve local profiles and recordings. No forced skipWaiting on install, no automatic storage clearing.
- Tests assert manifest, icons, cached paths and explicit-update safety.

## V0.6 Section 3 — Reaction Challenge
- The second game is registered through the existing game platform and shares the camera, stable marker filter, consent-governed participant roster, optional voice engine, four-section board and PWA shell.
- Reaction Challenge uses exactly the same 30/60/90/120-second interval and 5/10/15/20-round setup options and manual green/blue or group shared-marker handoff.
- A score requires moving outside the highlighted random target and entering it after marker stabilization. Holding a marker inside or losing tracking cannot create repeated scores.
- Track successful hits, reaction time in milliseconds, best/average response and accuracy based on discrete incorrect-zone transitions rather than repeated camera frames. Physical camera/voice certification remains a separate human test.

## V0.6.3 — Face enrollment gallery and three-sample acceptance repair
- Show all five enrollment slots, with current valid saved-sample count, required minimum and real per-sample image thumbnails. Capture primary creates sample #1, and capture sample adds the second and third (up to five optional angles).
- Individual retake updates both photo and recognition embedding atomically in the in-memory gallery; choose gallery image as primary; remove a sample and update the recognition requirement immediately. Save persists paired images and descriptors in the existing local participant record.
- Preserve all historical descriptors and mark any missing historical photo accurately. No remote image upload, forced camera start or implied biometric ownership. Invalidate the PWA cache for upgraded participant UI.

- Fix enrollment camera reticle mapping for mirrored, cropped video. Correct left/right edge alignment, clip offscreen rectangles and smooth small detector jitter without retaining stale boxes after a large move. Add deterministic geometry tests for both mirror modes, aspect ratios and off-axis positions.

## V0.6.4 — Participants page layout refinement
- Remove redundant Identity/Storage/Enrolled/Camera/Voice status strip beneath header. Keep the enrolled count with the participant roster and camera indicator inside the capture area; preserve the identity engine status for screen readers.
- Make the LEFT participant roster retractable to a small desktop rail, with an accessible mobile slide-out (backdrop, Escape close, focus containment). Preserve current participant selection and uninterrupted camera/voice operation.
- Keep full five-sample photo gallery and voice-profile controls in the RIGHT-hand onboarding form. No replacement recognition or audio services; updated PWA cache and direct ZIP release.

## v0.6.5 — Camera-first Participants layout
- Full main-column live camera with correct face reticle and translucent camera status; screenshot-driven floating right Photo Gallery and Voice Profile cards that can independently retract and reopen without stopping media streams.
- Keep retractable LEFT participant roster, remove redundant status strip, maintain working local participant and voice enrollment controls within floating panels, and make the participant form a deliberate Settings overlay. Bottom glass dock exposes Settings, capture, Start/Stop and device switching when multiple cameras exist.
- Package the dedicated Participants layout CSS and JS in PWA shell and direct deploy ZIP. Visual browser/device inspection remains a separate physical acceptance gate.

## v0.6.6 — Player-to-game continuity and layout correction
- Reconcile same-origin saved participant selections when entering the lobby/game. Persist last manually enrolled/selected participant ID only; never synchronize biometric enrollment to other origins or claim a selected profile is camera-verified.
- Opt-in auto-start permission preference for previously granted browser camera access on Participants and Games. The browser remains permission authority; denied, prompt, unsupported and same-page manual Stop fail closed. Camera preference never enables microphone/voice capture.
- Isolate centered four-zone board from scores and instructions; a separate lower-left HUD shows score, identity evidence, marker evidence, voice readiness, round timer and group roster. Improve readability without changing game rules or the physical marker requirements.
- Add deterministic tests for permission gate, saved profile selection, layout contracts, PWA asset manifest and packaged deployment smoke imports. Live device certification still requires browser hardware checks.

## v0.6.7 — Scene analysis, participant false-positive control and left activity tabs
- Show actual camera/model/first-scan loading stages with a reduced-motion-compatible radar-style animation on Participants and game pages. Loading does not automatically certify unknown faces or block camera Stop controls.
- Reconcile mirrored camera-facing room radar with participant face previews, leaving raw computer-vision coordinates unchanged; actual camera-side orientation still needs user hardware verification.
- Keep provisional detections inside the internal perception engine; present/announce only stable known enrolled identities, with observation gates and bounded time-limited track retention.
- Combine LEFT Room Dialogue and Player Activity into keyboard-accessible tabs. Visual, ephemeral activity history shows meaningful zone changes, reaction times, targets, points and confirmed participant presence; all scheduled-player gameplay labels disclose unverified marker ownership.
- Test false-positive exclusion, mirrored projection, milestone progress, tab contracts, visual activity history and direct ZIP PWA assets.
