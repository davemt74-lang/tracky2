# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V011-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. Tracky2 V0.11 remains standalone: no VP3 Cloud or HomeServer integration.

## Completed and verified
- **V0.10A–10J** — completed/merged with their published releases and software delivery gates.
- **V0.11 planning** — PR [#43](https://github.com/davemt74-lang/tracky2/pull/43), merged `4844af4d13fd166ae0f59923500dfa9000dcdc9e`. Standalone V0.11 master plan. CI green.
- **11A — Conversation & Listening Engine V2** — PR [#44](https://github.com/davemt74-lang/tracky2/pull/44), merged `13fba900ee0190e6234ccde5be79123f70d798c5`. V0.11.0 deploy SHA-256 `90380e2d31b625af42d588acc4d3636647b54e436a29d494a227ee1f32bf1539`. **10/10**.
- **11B — Speaker & Participant Tracking V2** — PR [#45](https://github.com/davemt74-lang/tracky2/pull/45), merged `ad0558620de5e3bc1b8adec46e9d2f65e918b581`. V0.11.1 deploy SHA-256 `a3bddb1a51159e64503bd6a8d0afc59b6acc496efbd1cb39804033e93fdc2174`. **10/10**.
- **11C — Transcription Intelligence V2** — PR [#46](https://github.com/davemt74-lang/tracky2/pull/46), merged `286f9b6b6d249a14b78dee61886bf89edb37ed7a`. V0.11.2 deploy SHA-256 `6305fcaeac2c747c11d972cb4512703d9575db7eda1547c28aa4d2ba615e4b80`. **10/10**.
- **11D — Multi-Participant Conversation** — PR [#47](https://github.com/davemt74-lang/tracky2/pull/47), merged `e5fbc82a3fb7293972404f26e8fcd7b6c8802305`. V0.11.3 deploy SHA-256 `135a2bc307c1a1e566a86d0e9105da8e0ef0d60a41defa1282ca7a0065b116c4`. **10/10**.
- **11E — Dedicated Video Meeting Runtime** — PR [#48](https://github.com/davemt74-lang/tracky2/pull/48), merged `a895edaec95909bbfce7cc8a422d0905a35bb9fc`. V0.11.4 deploy SHA-256 `d25ac8cc02292a04b3d51e0230a2d4883ef305aa9fd28dc5ac2b2e07736a8a31`. **10/10**.
- **11F — Environmental / Media Audio Intelligence** — PR [#49](https://github.com/davemt74-lang/tracky2/pull/49), merged `a04181ab402cd4788b10c63c1fe9c12bb1fbb626`. Required/post-merge Node/PHP jobs passed. V0.11.5 deploy SHA-256 `69f064b3e25b65e85cac0838dab279847e3d53515eb939fdb3bca5e7da144ba1`. Session-only explicit consent, pinned local AudioSet classification, sensitive-label filtering, no participant attribution, no raw-audio persistence and no exact-media-ID claim. **10/10**.

## Active section: 11G — Spatial Interaction V2
- **Branch:** `feat/v011g-spatial-interaction-v2`, based on verified 11F main.
- **Audited baseline:** **7.1/10** before implementation. Existing scene areas and orb behavior were camera-relative and deliberately refused metric distance; there was no explicit physical-plane calibration.
- **Single-camera rule:** no new camera, detector, pose model or scene runtime is introduced. 11G reuses stable public tracks and the existing owner-defined ROOM map.
- **Optional calibration:** new `spatial-calibration-core.js` accepts only an explicit owner-defined floor plane: four normalized camera points ordered near-left → near-right → far-right → far-left plus measured room width/depth from 0.5m to 50m.
- **Projection:** a bounded planar homography maps current track footpoints into approximate floor coordinates. Occluded/reacquiring tracks, cropped footpoints, invalid geometry and out-of-plane projections abstain.
- **Provenance:** calibrated positions are labeled `owner-defined-floor-plane` and `approximate-planar-projection`. Without calibration, all existing ROOM area behavior remains camera-relative.
- **Listener anchor:** optional owner-entered listener X/depth enables approximate same-plane distance and bearing. No listener anchor means AGENT remains on camera-relative apparent proximity.
- **AGENT behavior:** orb screen-follow geometry is unchanged. Distance-aware reply volume uses calibrated listener distance only when a valid calibration + listener anchor exists; otherwise the existing camera-relative fallback is retained. Camera loss/no target resets reply volume to neutral.
- **ROOM UI:** owner can capture four floor corners by clicking the existing preview, enter dimensions/listener anchor, save locally, clear calibration independently, and see approximate current participant floor coordinates/distance. Mirror mode converts visible clicks back to raw camera coordinates before saving.
- **Scene schema:** ROOM scene metadata advances additively to schema 2 with optional calibration. Existing schema-1 camera-only maps load as uncalibrated without data loss.
- **Privacy:** only owner-entered calibration metadata is persisted. Live participant coordinates, frames, photos, audio, embeddings and calibrated track positions are never written into the scene record.
- **Tests:** calibration validation/degeneracy, exact corner mapping, current-vs-occluded footpoints, listener distance/bearing, pair distance, scene migration, separate area-vs-calibrated evidence, AGENT calibrated/fallback volume, mirror-aware UI capture and no-new-sensor/media-path fixtures.
- **Release target:** **V0.11.6**.
- **Pre-CI score:** **9.4/10**. Remaining score is full Node/package/PWA + PHP regression proof, merge, post-merge checks and direct V0.11.6 ZIP/SHA verification.

## Exact next action
Run the final V0.11.6 manifest/static review, open the 11G PR, execute the complete Node/package/PWA + PHP gates, repair only demonstrated failures, merge when green, verify V0.11.6 release assets/checksum, then begin **11H — Proactive Interactive Agent V2** from current main.

Representative physical camera/microphone acceptance remains separate from CI. Floor-plane calibration is approximate same-plane geometry, not a surveyed 3-D room model.
