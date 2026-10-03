# Tracky2 — Development execution checkpoint

Updated after Phase 0 audit; source-of-truth for resuming work is **GitHub main and CI**. Read `docs/V010-MASTER-PLAN.md` first, then compare the live repository and open PRs before resuming. Do not assume this document supersedes newer GitHub state.

- **Scope:** standalone Tracky2, no Cloud/HomeServer integration.
- **Released baseline verified:** V0.9.2; main `ef70eb2c1691903e4ab7e3c4f2ede7ea5b8d5641` at audit; deployment ZIP and checksum under the V0.9.2 GitHub release.
- **Current section:** Phase 0 plan/audit PR in progress. Phase 0 gate requires successful PR checks and merge; update checkpoint after completion.
- **Next section:** 10A, versioned canonical room-event ledger and deterministic replay.
- **Working interfaces:** `src/room-event-core.js`, `vertical-motion.js`, `src/participant-store.js`; preserve their exported legacy APIs. Do not add another microphone, camera, memory store or remote backend.
- **10A scope:** stable normalized event contract, corrected/duplicate handling, sensor-state transitions and replay/projection; integration with current existing session/opt-in ROOM observation view; deterministic tests for privacy, outages, stable replay and bounded storage.
- **Expected PR release process:** use a new version and matching package, PWA cache, CI deploy ZIP and SHA sidecar. Check exact build artifacts *after* PR and main workflows finish.
- **Hardware:** no installed-camera/microphone certification performed by this audit; automated CI must not be mislabeled as hardware testing.
- **Resume first action:** check Phase 0 PR/CI/merge; only begin 10A after green merge. Subsequent section PRs use current `main`, never a guessed earlier SHA.
