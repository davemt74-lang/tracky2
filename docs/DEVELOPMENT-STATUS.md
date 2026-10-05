# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V012-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. Tracky2 remains standalone.

## Completed and verified
- **V0.10A–10J** — complete.
- **V0.11A–11J** — complete at **V0.11.9**. Final V0.11 merge: `2cd4cda227b611fa7615019a8c3f1b42900edfc5`. Software delivery **10/10**.
- **V0.12 planning** — PR #54 merged at `07667d9f3a47fec2d3bf370bc8294d3d91836fb1`.
- **12A — Canonical Multimodal Identity Fusion** — PR #55 merged at `4a13ee8b1616a900ced3b4f5aaac0708cf4c6305`. V0.12.0 post-merge green. **10/10**.
- **12B — Shared-Microphone Diarization** — PR #56 merged at `d8ae0b728851fa40bebfd8b90b65f588f3359e7d`. V0.12.1 post-merge green. **10/10**.
- **12C — Continuous Camera + Voice Fusion** — PR #57 merged at `348244185c372cd9ca7420ec93b8f677aa3dcc23`. V0.12.2 post-merge green. **10/10**.
- **12D — Real-Time Multi-Person Attribution** — PR #58 merged at `709155df72da0f9793e5034561f25ab523047c6f`. V0.12.3 post-merge green. **10/10**.
- **12E — Recording & Session Identity Timeline** — PR #59 merged at `3420c5a1402cae6b55c2748a04c5a356e8b56558`. V0.12.4 post-merge Node/package/PWA + PHP green and deploy artifact verified. **10/10**.
- Physical camera/microphone representative-device evidence remains separate from CI.

## Active section: 12F — Multi-Room / Handoff Intelligence
- **Branch:** `feat/v012f-multi-room-handoff-intelligence`.
- **Audited baseline:** **7.4/10**. Tracky2 already treated camera loss conservatively and refused to infer room departure from camera-area movement, but it had no room-level identity or explicit cross-room handoff model.
- Added pure `src/room-handoff-core.js` with participant room presence, uncertain departure, same-room re-entry, explicit departure, explicit handoff, target-room confirmation, stale prior-room evidence, simultaneous-room conflict and participant-deletion reconciliation.
- **No teleport rule:** a participant disappearing from one camera and later appearing in another room never creates an inferred route or room transition. Cross-room observations without an explicit handoff remain unlinked/conflicted.
- An explicit handoff is only **pending** when declared. It becomes **confirmed** only when the participant is subsequently observed in the declared destination room inside the bounded confirmation window.
- A simple camera out-of-view event becomes `uncertain-departure`, not `departed`. Same-room re-entry is modeled separately and does not invent a room transition.
- Simultaneous fresh observations in different rooms produce `simultaneous-room-conflict`; identity is not duplicated and neither room silently wins.
- Stale prior-room evidence may permit a new current-room observation, but the route between rooms remains explicitly unknown.
- Explicit departure retires the prior room's active observation evidence, preventing a later legitimate observation from being mislabeled as simultaneous.
- The existing owner-defined room map now includes stable **physical room ID + room name** metadata while retaining the same `local-room` IndexedDB storage key and existing camera-area semantics.
- AGENT/ROOM now exposes explicit handoff controls: choose an enrolled participant, declare a destination room ID, or explicitly confirm departure from the current room.
- Canonical ROOM observations carry bounded `roomId` metadata. ROOM deduplication now includes `roomId`, so same-participant observations from two rooms cannot collapse into one event.
- Accepted dialogue turns carry capture room ID/name plus bounded handoff state/provenance. Transcript export and the canonical session timeline include room identity metadata without raw media.
- Participant deletion clears in-memory handoff state through the existing participant reload/reconciliation path.
- Pure handoff logic opens no camera, microphone, storage, network or duplicate participant system.
- Release target: **V0.12.5** with package/PWA/runtime-audit/deploy-manifest wiring.
- Deterministic fixtures cover leave/re-entry, uncertain departure, explicit handoff, target confirmation, stale prior room, simultaneous rooms, explicit departure, participant deletion, room-scoped event dedupe, bounded provenance and no media/network/persistence side effects.
- **Pre-CI score: 9.7/10.** Remaining 0.3 is full Node/package/PWA + PHP proof, PR merge, post-merge verification and V0.12.5 artifact validation.

## Exact next action
Open the 12F PR, repair only demonstrated failures, merge when all required checks are green, verify post-merge V0.12.5 packaging, score 12F **10/10**, then begin **12G — Advanced Spatial + Audio Source Intelligence** from merged main.
