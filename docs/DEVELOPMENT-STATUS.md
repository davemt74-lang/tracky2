# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V012-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. Tracky2 remains standalone.

## Completed and verified
- **V0.10A–10J** — complete.
- **V0.11A–11J** — complete at **V0.11.9**. Final V0.11 merge: `2cd4cda227b611fa7615019a8c3f1b42900edfc5`. Node/package/PWA and PHP post-merge gates green. Software delivery **10/10**.
- **V0.12 planning** — PR #54 merged at `07667d9f3a47fec2d3bf370bc8294d3d91836fb1`.
- Physical camera/microphone representative-device evidence remains separate from CI and is not claimed as universal hardware certification.

## Active section: 12A — Canonical Multimodal Identity Fusion
- **Branch:** `feat/v012a-canonical-multimodal-identity-fusion`.
- **Audited baseline:** **7.6/10**.
- Added pure `src/multimodal-identity-core.js` with normalized voice, face, body/track, spatial, conversation and revocation evidence.
- Voice Profile remains the primary speaker identity authority for 12A. Face can support/contradict; body/track continuity can support; spatial/conversation are context only.
- Fusion exposes explicit state, decision, confidence band, authority, bounded provenance, conflicts, evidence age/freshness and abstention reason.
- Ambiguous/unmatched voice never promotes the only visible participant to speaker.
- Duplicate visual identity cannot strengthen/select a body track.
- Current conflicting visual identity is recorded without silently overriding verified voice.
- Explicit voice-authority revocation forces abstention.
- Fusion transition tracking never carries a prior participant into unknown/abstained evidence.
- Canonical dialogue turns receive additive fusion metadata; transcript authority remains unchanged.
- Participant deletion removes directly attributed turns and scrubs multimodal context/evidence references from remaining turns.
- AGENT and ROOM dialogue views expose fusion state/conflicts/abstention.
- No new microphone, camera, persistence, model-download or network path.
- Release target: **V0.12.0** with package/PWA/audit/deploy manifest wiring.
- Deterministic 12A fixtures cover multimodal agreement, body continuity, visual conflict, duplicate visual identity, ambiguity, camera-relative/context-only evidence, stale evidence, revocation, transitions, canonical metadata and deletion propagation.
- **Pre-CI score: 9.7/10.** Remaining 0.3 is full Node/package/PWA + PHP proof, PR merge, post-merge verification and V0.12.0 ZIP/SHA validation.

## Exact next action
Open the 12A PR, repair only demonstrated CI failures, merge when all checks are green, verify the V0.12.0 deploy artifact/checksum, score 12A **10/10**, then begin **12B — Shared-Microphone Diarization** from the merged main branch.
