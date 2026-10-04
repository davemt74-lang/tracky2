# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V012-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. Tracky2 remains standalone.

## Completed and verified
- **V0.10A–10J** — complete.
- **V0.11A–11J** — complete at **V0.11.9**. Final V0.11 merge: `2cd4cda227b611fa7615019a8c3f1b42900edfc5`. Software delivery **10/10**.
- **V0.12 planning** — PR #54 merged at `07667d9f3a47fec2d3bf370bc8294d3d91836fb1`.
- **12A — Canonical Multimodal Identity Fusion** — PR #55 merged at `4a13ee8b1616a900ced3b4f5aaac0708cf4c6305`. Post-merge Node/package/PWA + PHP green. V0.12.0 deploy artifact produced. **10/10**.
- Physical camera/microphone representative-device evidence remains separate from CI.

## Active section: 12B — Shared-Microphone Diarization
- **Branch:** `feat/v012b-shared-microphone-diarization`.
- **Audited baseline:** **6.8/10**. V0.11/12A had one canonical room mic and strong whole-segment speaker matching, but no within-segment speaker clustering/change/overlap contract.
- Added pure `src/speaker-diarization-core.js` with bounded PCM windows, identity-agnostic speaker clusters, overlap ambiguity, unknown states, cluster-capacity bounds and persistent-safe turn metadata.
- Reuses the existing `RoomAudioCapture` PCM and existing `VoiceIdentityEngine`; no second live microphone and no new audio persistence.
- Diarization work is bounded to at most six representative windows per accepted segment and remains inside the existing listening generation/deadline lifecycle.
- Segment analysis is transactional: clustering runs against a fork and commits only after the segment remains current, so cancelled/stale work cannot poison later session clusters.
- Session speaker cluster IDs are temporary `D1…Dn` labels and reset with room audio; they are not participant identities.
- A mixed embedding that plausibly matches two established clusters becomes **overlap-unresolved** rather than being forced to one speaker.
- Low-quality windows and cluster-capacity pressure remain explicit unknown states.
- Multiple sequential speaker clusters or unresolved overlap suppress legacy whole-turn participant attribution. Transcript content may still persist canonically, but speaker identity stays unresolved.
- Multi-participant conversation policy abstains on both overlap and multiple speakers inside one captured turn.
- Canonical turns store only bounded diarization spans and provenance; embeddings/PCM are never persisted.
- ROOM and AGENT conversation views surface diarization state, cluster count, overlap and attribution suppression.
- Release target: **V0.12.1** with package/PWA/runtime-audit/deploy-manifest wiring.
- Deterministic tests cover bounded window selection, one/two speaker clustering, overlap ambiguity, low quality, cluster limits, cancellation, transactional isolation, no second mic, metadata privacy and AGENT abstention.
- **Pre-CI score: 9.7/10.** Remaining 0.3 is full Node/package/PWA + PHP proof, PR merge, post-merge verification and V0.12.1 artifact validation.

## Exact next action
Open the 12B PR, repair only demonstrated failures, merge when all required checks are green, verify post-merge V0.12.1 packaging, score 12B **10/10**, then begin **12C — Continuous Camera + Voice Fusion** from merged main.
