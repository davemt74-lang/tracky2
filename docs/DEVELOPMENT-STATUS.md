# Tracky2 — Standalone development checkpoint

**Start every resumed session:** Read `docs/V010-MASTER-PLAN.md`, inspect GitHub main, open PRs and CI. This checkpoint is an aid, not permission to ignore newer commits. No VP3 Cloud or HomeServer integration.

## Completed and verified
- **Phase 0:** PR [#32](https://github.com/davemt74-lang/tracky2/pull/32), merged `b706945c09c1b30798857b05cd46f5545e9d6db9`. Baseline audit, master plan and idempotent release workflow. Green required and post-merge workflows.
- **10A:** PR [#33](https://github.com/davemt74-lang/tracky2/pull/33), merged `08fc61ea25892a941eee4bf49ebd8281f36e302a`. Versioned canonical ROOM ledger, correction, replay, sensor-state integrity. Release [V0.10.0](https://github.com/davemt74-lang/tracky2/releases/tag/v0.10.0), deploy SHA-256 `b9ea8253396ea890b9fb4c1c9d9c95cd0a153758075069d983ec5d823ed0010e`. Delivery gates **10/10**.
- **10B:** PR [#34](https://github.com/davemt74-lang/tracky2/pull/34), merged `fa36c9894faa41bd8559a3ea61e4082a714aa1a8`. Local owner-defined scene graph, camera areas, semantic objects, overlap/occlusion uncertainty, accessible ROOM map and IndexedDB v4. Release [V0.10.1](https://github.com/davemt74-lang/tracky2/releases/tag/v0.10.1), direct ZIP + checksum verified, deploy SHA-256 `252ab608ff13835cd4b22ab99a19cd3049aee85773ec192c4bdbdba994532050`. Delivery gates **10/10**.
- **Physical hardware:** not certified by the preceding automated workflows. Camera-relative geometry is *not* calibrated physical location.

## Active section
- **10C — participant movement and temporal awareness**, working branch `feat/v010c-temporal-participant-awareness`, based on verified 10B main. **Implementation pending / in progress** until PR, required CI, merge, post-merge CI and direct deployment checksum are verified.
- Reuse existing stable public tracks, `src/room-scene-graph.js` and canonical `src/room-event-core.js`; no parallel camera/audio, no duplicative database.
- Deliver a bounded ephemeral temporal engine, robust area-transition confirmation, stationary and area dwell metadata, movement summaries, conservative handling of occlusion, reconnect and owner map edits, plus a readable ROOM activity state.
- Never classify stillness as sleep, absence from view as exiting the room, or camera-perspective motion as calibrated physical travel. Event persistence follows the existing explicit ROOM opt-in only.
- Target next version **V0.10.2**; tests and package must include any new files and update PWA cache.
- **Next action:** implement pure `src/room-temporal-core.js` and tests, connect to existing ROOM and owner map; open PR; merge only after Node and PHP checks green; verify post-merge release ZIP + SHA before beginning 10D.
