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
- **12E — Recording & Session Identity Timeline** — PR #59 merged at `3420c5a1402cae6b55c2748a04c5a356e8b56558`. V0.12.4 post-merge green. **10/10**.
- **12F — Multi-Room / Handoff Intelligence** — PR #60 merged at `f13168c9b5f338fac73d3d653679865ad339429e`. V0.12.5 post-merge Node/package/PWA + PHP green and deploy artifact verified. **10/10**.
- Physical camera/microphone representative-device evidence remains separate from CI.

## Active section: 12G — Advanced Spatial + Audio Source Intelligence
- **Branch:** `feat/v012g-spatial-audio-source-intelligence`.
- **Audited baseline:** **7.5/10**. Visual spatial calibration already provided approximate floor-plane bearing/distance, but shared room audio was intentionally captured as mono and therefore had no directional-source evidence.
- Added pure `src/spatial-audio-source-core.js` for bounded stereo left/right energy evidence, visual source direction, calibrated metric distance/bearing when owner floor calibration exists, and explicit audio/visual agreement or conflict.
- **Identity boundary:** directional audio is context only. It never becomes voice/face identity authority, never assigns a participant ID, and never overrides canonical multimodal identity.
- The existing single `RoomAudioCapture` now **prefers stereo when hardware/browser supports it** via `channelCount: { ideal: 2 }`. There is still exactly one `getUserMedia` microphone path.
- AudioWorklet and ScriptProcessor fallback both downmix the same capture to the existing mono PCM stream for VAD, transcription, voice matching, diarization and environmental classification.
- Stereo handling retains only bounded per-frame left/right RMS aggregates for the active speech segment; raw per-channel PCM is not persisted or added to canonical turns.
- Mono/unsupported hardware remains valid and reports `audio-direction-unavailable` rather than fabricating direction.
- Stable stereo asymmetry produces left/right contextual direction; unstable/alternating evidence becomes `uncertain`.
- Visual source evidence uses owner-calibrated floor-plane bearing/distance when available; otherwise it remains camera-relative and explicitly non-metric.
- Audio/visual direction agreement is labeled as supporting context. Disagreement becomes `audio-visual-direction-conflict` and the fused direction becomes uncertain rather than silently choosing one source.
- Mirrored camera presentation does not flip the raw physical source evidence path.
- The live ROOM HUD exposes capture channel count and source-direction state/confidence/metric status/conflict.
- Accepted canonical dialogue turns carry bounded spatial-audio metadata/provenance; transcript export and conversation timeline carry only that metadata, never source audio.
- Release target: **V0.12.6** with package/PWA/runtime-audit/deploy-manifest wiring.
- Deterministic fixtures cover mono fallback, stable stereo direction, unstable evidence, calibrated metric visual source, uncalibrated non-metric source, audio/visual agreement, explicit conflicts, mirror presentation, single microphone path, bounded turn metadata and pure-core safety.
- **Pre-CI score: 9.7/10.** Remaining 0.3 is full Node/package/PWA + PHP proof, PR merge, post-merge verification and V0.12.6 artifact validation.

## Exact next action
Open the 12G PR, repair only demonstrated failures, merge when all required checks are green, verify post-merge V0.12.6 packaging, score 12G **10/10**, then begin **12H** from merged main according to `docs/V012-MASTER-PLAN.md`.
