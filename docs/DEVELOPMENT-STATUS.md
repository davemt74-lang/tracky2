# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V010-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. Tracky2 remains independent from VP3 Cloud and HomeServer.

## Completed and verified
- **Phase 0** — PR [#32](https://github.com/davemt74-lang/tracky2/pull/32), merged `b706945c09c1b30798857b05cd46f5545e9d6db9`. Baseline audit/master plan/release guard. Required and post-merge CI green.
- **10A** — PR [#33](https://github.com/davemt74-lang/tracky2/pull/33), merged `08fc61ea25892a941eee4bf49ebd8281f36e302a`. Canonical ROOM event ledger, correction, replay and sensor state. V0.10.0 deploy SHA-256 `b9ea8253396ea890b9fb4c1c9d9c95cd0a153758075069d983ec5d823ed0010e`. Delivery gates **10/10**.
- **10B** — PR [#34](https://github.com/davemt74-lang/tracky2/pull/34), merged `fa36c9894faa41bd8559a3ea61e4082a714aa1a8`. Owner-defined camera-relative scene graph, areas/objects, ambiguity and local IndexedDB. V0.10.1 deploy SHA-256 `252ab608ff13835cd4b22ab99a19cd3049aee85773ec192c4bdbdba994532050`. Delivery gates **10/10**.
- **10C** — PR [#35](https://github.com/davemt74-lang/tracky2/pull/35), merged `ebbcb71d71253aedf8981cc5124b8f7e60d4ca84`. Conservative movement, area transitions/dwell, relative stillness and interruption-safe temporal state. V0.10.2 deploy SHA-256 `375d6b90e281b6151581411a0ca659e1644ba507e1851c7812e636a883038441`. Delivery gates **10/10**.
- **10D** — PR [#36](https://github.com/davemt74-lang/tracky2/pull/36), merged `ed09c180576a7a2820b72d6d064fa08ce5898ff8`. Explicit session-only acoustic pattern opt-in, canonical transcript correction, duplicate transcript removal and TTS-suppression integrity. V0.10.3 deploy SHA-256 `aac31ad113b01471d5e512976069bd9282c29a9be7a8cd387979a16fe562991f`. Delivery gates **10/10**.

Automated delivery gates do **not** constitute physical camera/microphone certification. Camera-relative geometry is not calibrated physical position; acoustic pattern metadata does not identify sound sources or diagnose health.

## Active section: 10E — governed cognitive loop
- **Branch:** `feat/v010e-governed-cognitive-loop`, based on verified 10D main.
- **Current implementation:** canonical `participant-observed` ROOM evidence feeds an explicit observe → verify → interpret → evaluate → decide trace. The only permitted proactive action in 10E is the already-existing local greeting; every other outcome is explicit abstention.
- **Identity gate:** enrolled participant ID and live stable `matched`/`body-lock` track must agree. Unknown visitors, disabled recognition and uncertain tracks cannot trigger a greeting.
- **Governance:** global auto-greeting toggle, participant-level greeting opt-out, optional session-only quiet hours, active-conversation/TTS suppression, participant cooldown and hourly interruption cap.
- **Audit:** decision and outcome events link back to canonical source evidence through `relatedEventId`; failed execution does not consume a successful greeting cooldown. Participant deletion purges ephemeral cognitive history.
- **UI:** AGENT tab exposes engagement policy, quiet hours and latest explainable decision. Participant cards expose per-person greeting permission.
- **Tests:** deterministic policy, quiet-hours, identity, opt-out, busy/abstention, cooldown, hourly cap, deletion and integration tests are on the branch.
- **Release target:** V0.10.4. Package/PWA/audit/CI include `src/agent-cognitive-core.js`.
- **Gate remaining:** PR Node/PHP checks → merge → post-merge checks → verify direct V0.10.4 ZIP + SHA-256. Only then mark 10E **10/10** and begin 10F.

## Exact next action
Open the 10E PR from the current branch, verify required CI, repair only demonstrated failures, merge when green, verify the V0.10.4 release assets/checksum, update this checkpoint, then begin **10F — approved skill/task execution** from current main.

No arbitrary skill execution is part of 10E. 10F must extend the existing standalone skill registry rather than create a competing automation system.
