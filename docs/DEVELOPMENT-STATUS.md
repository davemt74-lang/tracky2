# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V012-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. Tracky2 remains standalone.

## Completed and verified
- **V0.10A–10J** — complete.
- **V0.11A–11J** — complete at **V0.11.9**. Final V0.11 merge: `2cd4cda227b611fa7615019a8c3f1b42900edfc5`. Software delivery **10/10**.
- **V0.12 planning** — PR #54 merged at `07667d9f3a47fec2d3bf370bc8294d3d91836fb1`.
- **12A — Canonical Multimodal Identity Fusion** — PR #55 merged at `4a13ee8b1616a900ced3b4f5aaac0708cf4c6305`. Post-merge Node/package/PWA + PHP green. V0.12.0 artifact produced. **10/10**.
- **12B — Shared-Microphone Diarization** — PR #56 merged at `d8ae0b728851fa40bebfd8b90b65f588f3359e7d`. Post-merge Node/package/PWA + PHP green. V0.12.1 artifact produced. **10/10**.
- **12C — Continuous Camera + Voice Fusion** — PR #57 merged at `348244185c372cd9ca7420ec93b8f677aa3dcc23`. Post-merge Node/package/PWA + PHP green. V0.12.2 artifact produced. **10/10**.
- Physical camera/microphone representative-device evidence remains separate from CI.

## Active section: 12D — Real-Time Multi-Person Attribution
- **Branch:** `feat/v012d-real-time-multi-person-attribution`.
- **Audited baseline:** **7.3/10**. 12B/12C could identify multiple diarized clusters and continuous participant links, but the canonical transcript turn still lacked a first-class interval ownership model and owner speaker corrections.
- Added pure `src/multi-person-attribution-core.js` to convert diarization spans plus continuous-fusion window links into one bounded canonical turn-attribution object.
- A single transcript turn can now retain multiple speaker intervals, participant candidates, overlap intervals, ownership changes, interruption counts and partial/unresolved attribution without duplicating transcript text.
- Overlap remains an observed sensor fact even after an owner changes interval ownership; correction cannot erase the original interruption/overlap state.
- Top-level verified-speaker fields remain conservative. Owner corrections are stored separately as `local-owner-correction` authority and never masquerade as biometric voice verification.
- Owner corrections are transactional in the canonical dialogue store and retain bounded prior participant/state provenance.
- AGENT exposes separate **Edit transcript** and **Correct speaker attribution** controls. Speaker correction selects a specific time interval and an enrolled participant or clears the attribution.
- Multi-participant reply policy abstains when canonical interval ownership shows overlap or a speaker ownership change.
- Participant deletion scrubs interval participant/candidate/correction references in addition to existing multimodal/continuous-fusion references.
- Transcript export includes bounded interval/correction metadata and participant labels while excluding raw audio, PCM, embeddings, photos and other media/biometrics.
- ROOM and AGENT views expose attribution state, interval count, ownership changes, interruptions, partial attribution and owner-correction state.
- Release target: **V0.12.3** with package/PWA/runtime-audit/deploy-manifest wiring.
- Deterministic fixtures cover sequential speaker ownership, overlap candidates, partial attribution, owner assign/clear correction, preserved interruption evidence, participant deletion, bounded provenance, canonical persistence, export/privacy and no new sensor/network/persistence path in the pure core.
- **Pre-CI score: 9.7/10.** Remaining 0.3 is full Node/package/PWA + PHP proof, PR merge, post-merge verification and V0.12.3 artifact validation.

## Exact next action
Open the 12D PR, repair only demonstrated failures, merge when all required checks are green, verify post-merge V0.12.3 packaging, score 12D **10/10**, then begin **12E — Recording & Session Identity Timeline** from merged main.
