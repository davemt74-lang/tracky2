# Tracky2 — Gameplay roadmap

## Restored baseline
Original Tracky V0.7, PR #9 merged commit a8ed0c134b0bb2b77ed596828d564d9d4de9cf9b. Preserve Vertical Motion gameplay, green-object tracking, calibration, raw movement analytics, local enrolled participant recognition, persistent full-body tracking, voice profiles and optional transcription. Keep this independent of Agent Eyes and VP3 Cloud.

## V0.2 modularization
- Game lifecycle, scoring dispatch, signal loss and bounded gameplay events are isolated from browser UI and participant/voice engines.
- Raw color-camera adapter and pure UI presenter can be reused independently. The original single-controller rules remain unchanged except that tracking loss resets partial reps.
- The original participant and voice engines remain separate modules; the large browser integration controller will be decomposed incrementally after hardware verification.
- This release does not claim multiplayer or hardware certification.

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
