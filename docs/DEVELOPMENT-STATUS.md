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
- **10C VERIFIED:** [PR #35](https://github.com/davemt74-lang/tracky2/pull/35) merged `ebbcb71d71253aedf8981cc5124b8f7e60d4ca84`; 224/224 Node tests, PHP and both post-merge jobs passed; direct [V0.10.2 release](https://github.com/davemt74-lang/tracky2/releases/tag/v0.10.2) with deployment SHA-256 `375d6b90e281b6151581411a0ca659e1644ba507e1851c7812e636a883038441`. Delivery gates 10/10; physical camera acceptance remains separate.

## Active section: 10D — audio/dialogue integrity
- **Branch:** `feat/v010d-audio-dialogue-integrity`, based on verified 10C main.
- Audit: the existing shared microphone uses `src/room-audio-engine.js`; enrolled speaker verification/gating is `src/voice-core.js`, transcripts are canonical IndexedDB `dialogue-turns`, AGENT chat currently duplicates participant transcripts into its separate localStorage reply history, and ROOM acoustic audit only measures amplitude/VAD. This section must eliminate duplicate transcript persistence before adding owner corrections.
- Build privacy-gated optional **acoustic pattern metadata** (sustained/intermittent energy patterns only; never label music, television, cough, specific acoustic source or a medical condition), interruption-safe ambient summaries, owner transcript correction with immutable attribution metadata and correction history, deduplicated unified chat that respects deletion, and speaker/TTS fail-closed tests.
- Advanced music/TV identification and multi-speaker source separation remain separately scoped until an appropriate explicitly authorized model/service and real hardware acceptance.
- **Gate:** do not mark complete or start 10E until PR Node/PHP checks, merge, post-merge jobs, direct V0.10.3 deploy ZIP and SHA are all verified. Real-device testing remains independent.
