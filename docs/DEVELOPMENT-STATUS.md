# Tracky2 — Development execution checkpoint

Updated after Phase 0 audit; source-of-truth for resuming work is **GitHub main and CI**. Read `docs/V010-MASTER-PLAN.md` first, then compare the live repository and open PRs before resuming. Do not assume this document supersedes newer GitHub state.

- **Scope:** standalone Tracky2, no Cloud/HomeServer integration.
- **Released baseline verified:** V0.9.2; main `ef70eb2c1691903e4ab7e3c4f2ede7ea5b8d5641` at audit; deployment ZIP and checksum under the V0.9.2 GitHub release.
- **Phase 0:** [PR #32](https://github.com/davemt74-lang/tracky2/pull/32) merged, CI and post-merge checks passed. Main at phase completion: b706945c09c1b30798857b05cd46f5545e9d6db9.
- **Current section:** 10A — canonical ROOM event ledger, tests and release V0.10.0 in PR; do not call 10A complete before all required PR and post-merge checks pass and release asset is verified.
- **Next section after completed 10A:** 10B owner-defined standalone scene graph.
- **Working interfaces:** `src/room-event-core.js`, `vertical-motion.js`, `src/participant-store.js`; preserve their exported legacy APIs. Do not add another microphone, camera, memory store or remote backend.
- **10A scope:** stable normalized event contract, corrected/duplicate handling, sensor-state transitions and replay/projection; integration with current existing session/opt-in ROOM observation view; deterministic tests for privacy, outages, stable replay and bounded storage.
- **Expected PR release process:** use a new version and matching package, PWA cache, CI deploy ZIP and SHA sidecar. Check exact build artifacts *after* PR and main workflows finish.
- **Hardware:** no installed-camera/microphone certification performed by this audit; automated CI must not be mislabeled as hardware testing.
- **Resume first action:** inspect the active 10A PR and CI, reconcile main; merge only after required checks are green, verify direct V0.10.0 deploy ZIP and SHA-256, then update the checkpoint and begin 10B. Subsequent section PRs use current `main`, never a guessed earlier SHA.
