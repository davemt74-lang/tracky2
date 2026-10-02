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
