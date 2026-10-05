# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V013-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. Tracky2 remains standalone.

## Completed and verified
- **V0.10A–10J** — complete.
- **V0.11A–11J** — complete at **V0.11.9**. Final V0.11 merge: `2cd4cda227b611fa7615019a8c3f1b42900edfc5`. Software delivery **10/10**.
- **V0.12 planning** — PR #54 merged at `07667d9f3a47fec2d3bf370bc8294d3d91836fb1`.
- **12A — Canonical Multimodal Identity Fusion** — PR #55 merged at `4a13ee8b1616a900ced3b4f5aaac0708cf4c6305`. **10/10**.
- **12B — Shared-Microphone Diarization** — PR #56 merged at `d8ae0b728851fa40bebfd8b90b65f588f3359e7d`. **10/10**.
- **12C — Continuous Camera + Voice Fusion** — PR #57 merged at `348244185c372cd9ca7420ec93b8f677aa3dcc23`. **10/10**.
- **12D — Real-Time Multi-Person Attribution** — PR #58 merged at `709155df72da0f9793e5034561f25ab523047c6f`. **10/10**.
- **12E — Recording & Session Identity Timeline** — PR #59 merged at `3420c5a1402cae6b55c2748a04c5a356e8b56558`. **10/10**.
- **12F — Multi-Room / Handoff Intelligence** — PR #60 merged at `f13168c9b5f338fac73d3d653679865ad339429e`. **10/10**.
- **12G — Advanced Spatial + Audio Source Intelligence** — PR #61 merged at `306c9c7007b29253a874d421c602fcf0906f9867`. **10/10**.
- **12H — Agent Multimodal Reasoning** — PR #62 merged at `20ce21e5fa370be2a5b7f0b65ad01346206efa50`. **10/10**.
- **12I — Long-Session / Stress Hardening** — PR #63 merged at `4abdea292eaf65df0da1fb8a46563cd5d6ec4690`. V0.12.8 post-merge Node/package/PWA + PHP green and deploy artifact verified. **10/10**.
- **12J — V0.12 Release** — PR #64 merged at `7cea628b8d4ebbce8c5573c40d4b2f124e0b37fd`. V0.12.9 post-merge Node/package/PWA + PHP green; deploy artifact and direct GitHub release published with verified SHA-256 `c58e212a04f98cd5857c740bc3d4b7263d18a4337652a2b44b03523d0473e41f`. **10/10**.
- **Complete V0.12 software delivery:** **10/10**.
- Physical camera/microphone/multi-speaker representative-device evidence remains separate from CI.

## Completed release: V0.12.9
- **Branch:** `feat/v012j-final-release`.
- Final release target: **V0.12.9**.
- Added pure `src/v012-release-core.js` with the complete A–I software gate, canonical runtime-bound checks, one-mic/one-transcript/no-identity-shortcut evidence boundaries, artifact integrity checks and an explicit `universalHardwareClaim:false` result.
- Added `docs/V012-RELEASE-ACCEPTANCE.md` documenting every V0.12 section, privacy/deletion invariants, accessibility regression requirements and the separate physical-device evidence boundary.
- Added deterministic 12J release regressions covering every 12A–12I test file, one live room microphone, canonical identity/deletion behavior, AGENT no-override, PWA shell contents, final package/version/checksum wiring and pure release-core safety.
- Package and runtime audit now require **V0.12.9**, `src/v012-release-core.js` and the V0.12 acceptance document.
- PWA cache is **tracky2-static-v0.12.9** and contains the V0.12 release core alongside all A–I runtime modules.
- CI builds `tracky2-v0.12.9-deploy.zip`, verifies the complete V0.12 runtime/acceptance artifacts, smoke-imports the V0.12 release core, produces `tracky2-v0.12.9-deploy.zip.sha256`, uploads both and publishes a direct GitHub release on merged `main`.
- Diagnostics hardware-evidence export reports **0.12.9** while continuing to state that representative-device evidence is not universal hardware certification.
- No new camera, microphone, transcript, identity, storage or network authority is introduced by 12J.
- **Final score: 10/10.** PR #64, post-merge CI, V0.12.9 artifact, direct release asset and SHA-256 are verified.

## V0.13 planning
- **V0.13 — Real-World Agent Intelligence & Reliability** is defined in `docs/V013-MASTER-PLAN.md`.
- Planning PR #66 merged at `4086ee2ce24a310b779f65e2c890de5453f27301` with green post-merge CI.
- Section baselines: **13A 7.4**, **13B 5.8**, **13C 7.6**, **13D 6.3**, **13E 5.4**, **13F 6.8**, **13G 5.9**, **13H 7.3**, **13I 7.9**, **13J 6.6**.
- V0.12 remains closed. V0.13 extends the existing canonical runtime and does not create parallel microphone, transcript, participant, memory or hidden-recording authorities.

## Completed V0.13 sections
- **13A — Representative Hardware Certification** — PR #67 merged at `27916ab492d8c6b9e1f8e9d4c5550754ea3b3660`. Post-merge Node/package/PWA + PHP green; direct **v0.13.0** ZIP + SHA-256 release published. **10/10**.
- Representative hardware PASS/PARTIAL/FAIL evidence remains specific to the actual tested device/browser/environment and is not universal hardware certification.

## Completed V0.13 sections
- **13A — Representative Hardware Certification** — PR #67 merged at `27916ab492d8c6b9e1f8e9d4c5550754ea3b3660`. Post-merge Node/package/PWA + PHP green; direct **v0.13.0** ZIP + SHA-256 release published. **10/10**.
- **13B — Overlapping-Speaker Source Separation V2** — PR #68 merged at `79bd3443c7f7cd3907646034ebf59204a51248f3`. Post-merge Node/package/PWA + PHP green; direct **v0.13.1** ZIP + SHA-256 release published. **10/10**.
- Representative hardware evidence remains specific to the tested device/browser/environment and is not universal certification.

## Active section: 13C — Advanced Participant Continuity
- **Branch:** `feat/v013c-advanced-participant-continuity`.
- **Audited baseline:** **7.6/10**.
- Added pure `src/participant-continuity-core.js` with bounded session-local verified-participant continuity.
- Continuity accepts only existing **face**, **voice**, or explicit **owner-correction** identity authority; it never creates a participant identity from proximity, clothing, body shape, orientation or AGENT inference.
- Short track fragmentation can recover an already verified participant for up to **12 seconds** when geometry, confidence and uniqueness remain strong.
- Longer same-room re-entry is tracked for up to **120 seconds** only as a **verification-required candidate**; face or verified voice must re-establish identity before participant assignment.
- Continuity scoring uses coarse current camera geometry plus decayed prior verified state. Appearance/color features are intentionally excluded so normal clothing/orientation changes do not become identity evidence.
- Duplicate-visible protection blocks continuity transfer when that participant is already assigned to another current track, and duplicate fragmented candidates are downgraded to ambiguous instead of assigning the same person twice.
- Verified voice + body association can recover a specific current track without stealing a participant already visible elsewhere.
- Participant cards expose owner **Correct identity…** controls to assign or clear the current track. Owner-cleared/rejected participant IDs are blocked from being immediately reattached by continuity.
- Participant deletion/revocation reconciles the continuity ledger and clears removed participant references from current tracks.
- Confidence/event history is bounded to **36 metadata-only rows per participant** and stores no photos, embeddings, raw audio or transcripts.
- Release target: **V0.13.2** with package/PWA/runtime-audit/deploy/direct-release wiring.
- Deterministic fixtures cover short fragmentation, long-gap verification requirement, expiry, clothing/orientation independence, duplicate-visible protection, duplicate fragments, voice recovery, owner correction/clear, rejected-match blocking, deletion/revocation, bounded privacy history and runtime integration.
- **Pre-CI score: 9.7/10.** Remaining 0.3 is full Node/package/PWA + PHP proof, PR merge, post-merge verification and V0.13.2 artifact/release validation.

## Exact next action
Open the 13C PR, repair only demonstrated failures, merge when all required checks are green, verify post-merge V0.13.2 ZIP/SHA-256/direct release, score **13C 10/10**, then start **13D — Multi-Room Runtime V2** from merged main.
