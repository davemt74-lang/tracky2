# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V012-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. Tracky2 remains standalone.

## Completed and verified
- **V0.10A–10J** — complete.
- **V0.11A–11J** — complete at **V0.11.9**. Final V0.11 merge: `2cd4cda227b611fa7615019a8c3f1b42900edfc5`. Software delivery **10/10**.
- **V0.12 planning** — PR #54 merged at `07667d9f3a47fec2d3bf370bc8294d3d91836fb1`.
- **12A — Canonical Multimodal Identity Fusion** — PR #55 merged at `4a13ee8b1616a900ced3b4f5aaac0708cf4c6305`. Post-merge Node/package/PWA + PHP green. V0.12.0 artifact produced. **10/10**.
- **12B — Shared-Microphone Diarization** — PR #56 merged at `d8ae0b728851fa40bebfd8b90b65f588f3359e7d`. 421/421 tests green before merge; post-merge Node/package/PWA + PHP green. V0.12.1 artifact produced. **10/10**.
- Physical camera/microphone representative-device evidence remains separate from CI.

## Active section: 12C — Continuous Camera + Voice Fusion
- **Branch:** `feat/v012c-continuous-camera-voice-fusion`.
- **Audited baseline:** **7.1/10**. 12A fused end-of-segment multimodal evidence and 12B diarized one shared microphone, but speaker windows were not yet aligned to the camera timeline.
- Added pure `src/continuous-fusion-core.js` with bounded visual history alignment, voice-anchored diarized cluster identity, conservative carry, explicit conflict states, bounded handoff confirmation and deletion/revocation reconciliation.
- Camera history is bounded in memory and never persists raw frames/photos. Each accepted diarized speaker window is aligned to the nearest mature room-track snapshot.
- Visual evidence alone never creates a speaker identity. Voice remains the identity authority; current camera/body evidence supports, contradicts or abstains.
- Camera loss or short occlusion can preserve a previously verified speaker-cluster identity only inside a bounded carry window with confidence decay.
- A contradictory verified participant cannot steal an existing speaker cluster on one observation. Handoff requires repeated verified evidence.
- If the current visual scene contradicts the carried speaker link, the window becomes an explicit visual conflict rather than silently following another visible participant.
- Diarization and continuous identity work are transactional per segment. Cancelled/stale analysis cannot mutate accepted cluster state.
- Whole-turn identity is suppressed when continuous window evidence conflicts with the whole-segment voice result.
- Canonical dialogue turns receive bounded continuous-fusion participant/cluster/window provenance only; no PCM, embeddings, raw frames or photos are stored by this layer.
- Participant deletion scrubs continuous-fusion participant references from retained canonical turns; runtime tracker reconciliation drops deleted/revoked participants.
- ROOM and AGENT conversation views expose continuous-fusion state, linked participant count, unresolved windows and conflicts.
- Release target: **V0.12.2** with package/PWA/runtime-audit/deploy-manifest wiring.
- Deterministic fixtures cover visual-time alignment, camera loss, no visual-only identity, occlusion continuity, expiry, contradictory handoff, visual conflict, deletion/revocation, transactional cancellation, bounded provenance and no media/network/persistence side effects in the pure core.
- **Pre-CI score: 9.7/10.** Remaining 0.3 is full Node/package/PWA + PHP proof, PR merge, post-merge verification and V0.12.2 artifact validation.

## Exact next action
Open the 12C PR, repair only demonstrated failures, merge when all required checks are green, verify post-merge V0.12.2 packaging, score 12C **10/10**, then begin **12D** from merged main.
