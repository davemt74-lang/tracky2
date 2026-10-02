# Tracky2 V0.5 game platform — Section 1

## Architectural contract
- `src/game-platform.js` registers game definitions with stable IDs and a DOM-free `createSession(settings)` factory. Games do not own webcams, identity enrollment, microphones, local storage or their own player databases.
- `src/shared-board.js` supplies pure four-zone board presentation plus a safe DOM paint function. It is shared by the new pattern and classic two-player match.
- `src/games/random-follow-pattern.js` contains the first timed game engine. It accepts normalized `{x,y,timestamp}` samples exclusively from the host and only for the assigned color. `src/games/pattern-setup.js` resolves player choices against locally enrolled profiles.
- The host's existing color detector, marker stability filter, face/body tracking, optional Voice Profiles and calibration are reused. Identity evidence never changes manual scoring assignments.

## Timed pattern rules
1. Select one or two locally enrolled players. Current physical markers support green for player 1 and blue for player 2; more physical players require adding controller sources in a later section.
2. Choose a **player interval** of 30, 60, 90, or 120 seconds, and **total game rounds** of 5, 10, 15, or 20. One interval equals one timed round. These are game-wide rounds, not rounds per participant.
3. The active participant follows highlighted random zones on the **one shared four-section board**. Each target requires between three and six full up/down reps; only reps completed within the highlighted zone count. Each cleared target is one point and triggers another random target without repeating the previous zone.
4. When the interval expires, the incomplete target is discarded and the next round moves to the next player (or repeats the sole participant). For odd total rounds with two players, the green starting player plays one more timed round.
5. Scoring ends at the exact round deadline, independent of camera-frame frequency; elapsed intervals still expire while the page is in a throttled/background state, and expired time is not credited upon return. Inactive colors and stale frames cannot score.

## Adding a game
Export a definition object with `id`, `title`, `description` and `createSession(options)`, then register it once with the platform. Return a session exposing explicit start/sample/tick/stop/snapshot behavior for testing. Keep per-game rules independent of the shared input, identity, voice and board presentation services. Reuse supported player/interval/round settings unless a later game explicitly documents alternatives.

## Safety and release limits
Face and voice enrollment remain optional, opt-in and local. Marker selection does not establish who physically holds a controller. The older opt-in classic match-history format is not silently reused for the new timed game's distinct round structure. Automated tests do not certify performance with live webcams or microphones.
