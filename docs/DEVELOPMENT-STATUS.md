# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V011-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. Tracky2 V0.11 remains standalone: no VP3 Cloud or HomeServer integration.

## Completed and verified
- **V0.10A–10J** — completed/merged with their published releases and software delivery gates.
- **V0.11 planning** — PR [#43](https://github.com/davemt74-lang/tracky2/pull/43), merged `4844af4d13fd166ae0f59923500dfa9000dcdc9e`. Standalone V0.11 master plan. CI green.
- **11A — Conversation & Listening Engine V2** — PR [#44](https://github.com/davemt74-lang/tracky2/pull/44), merged `13fba900ee0190e6234ccde5be79123f70d798c5`. V0.11.0 deploy SHA-256 `90380e2d31b625af42d588acc4d3636647b54e436a29d494a227ee1f32bf1539`. **10/10**.
- **11B — Speaker & Participant Tracking V2** — PR [#45](https://github.com/davemt74-lang/tracky2/pull/45), merged `ad0558620de5e3bc1b8adec46e9d2f65e918b581`. V0.11.1 deploy SHA-256 `a3bddb1a51159e64503bd6a8d0afc59b6acc496efbd1cb39804033e93fdc2174`. **10/10**.
- **11C — Transcription Intelligence V2** — PR [#46](https://github.com/davemt74-lang/tracky2/pull/46), merged `286f9b6b6d249a14b78dee61886bf89edb37ed7a`. V0.11.2 deploy SHA-256 `6305fcaeac2c747c11d972cb4512703d9575db7eda1547c28aa4d2ba615e4b80`. **10/10**.
- **11D — Multi-Participant Conversation** — PR [#47](https://github.com/davemt74-lang/tracky2/pull/47), merged `e5fbc82a3fb7293972404f26e8fcd7b6c8802305`. V0.11.3 deploy SHA-256 `135a2bc307c1a1e566a86d0e9105da8e0ef0d60a41defa1282ca7a0065b116c4`. **10/10**.
- **11E — Dedicated Video Meeting Runtime** — PR [#48](https://github.com/davemt74-lang/tracky2/pull/48), merged `a895edaec95909bbfce7cc8a422d0905a35bb9fc`. Required/post-merge Node/PHP jobs passed. V0.11.4 deploy SHA-256 `d25ac8cc02292a04b3d51e0230a2d4883ef305aa9fd28dc5ac2b2e07736a8a31`. One active meeting, canonical transcript references, verified roster metadata, owner notes/decisions/actions, meeting-scoped AGENT policy and no duplicate media/transcript path. **10/10**.

## Active section: 11F — Environmental / Media Audio Intelligence
- **Branch:** `feat/v011f-environmental-media-audio`, based on verified 11E main.
- **Audited baseline:** **6.9/10** before implementation. Existing `room-audio-audit.js` and `room-acoustic-patterns.js` correctly measured shared-room level/VAD metadata and explicitly refused to identify sound sources, but Tracky2 had no actual environmental classifier.
- **Single-microphone rule:** 11F does not create a new media capture path. It consumes only the already-emitted, non-suppressed PCM segments from the existing `RoomAudioCapture`.
- **Consent:** environmental classification is disabled by default and enabled only by an explicit session-only ROOM checkbox. The toggle is not persisted to localStorage and resets off on reload.
- **Local model:** lazy browser inference uses the pinned Transformers.js-compatible `Xenova/ast-finetuned-audioset-10-10-0.4593` model revision `c38c0051164d7433ccb1341e5c60d38f30608ac9` with q8 weights. Model assets may be downloaded/cached; Tracky2 does not upload room PCM to the model host.
- **Bounded sidecar:** environmental classification has its own 2-item metadata work queue, a 12-second work deadline, generation invalidation on consent removal, and no blocking `await` in the canonical conversation segment handoff.
- **False-positive policy:** approved coarse categories are music, media playback, alarm, animal, weather/water, transport, household/mechanical and impact/crowd. Low-confidence and ambiguous results abstain.
- **Sensitive-label filter:** speech/conversation, age/sex voice labels, coughing, sneezing, snoring, breathing, crying/screaming and similar human/health-sensitive labels are never emitted as environmental classifications. If the strongest model label is sensitive, Tracky2 does not fall through to a weaker environmental guess.
- **Attribution boundary:** environmental classifications always have `participantId=null`, `speakerAttribution='none'` and no exact media ID. A classification can never establish who produced a sound.
- **Media boundary:** coarse `music` / `media-playback` classifications are allowed from the model. Exact song, movie or TV-title identification is intentionally not implemented; that requires a separately approved provider/integration.
- **Persistence:** raw PCM is memory-only and never saved. When ROOM history saving is separately enabled, only the bounded classification message/source/confidence/duration metadata may enter the existing ROOM ledger.
- **Deduplication:** repeated identical classifications are throttled for 30 seconds unless category/label changes or confidence improves materially.
- **UI:** ROOM shows explicit classifier consent, model/loading/error/ready state and the latest approved source-unattributed classification.
- **Tests:** approved-category mapping, sensitive-label filtering, low-confidence/ambiguity abstention, bounded queue/consent invalidation, dedupe, pinned-model contract, one-microphone sidecar integration, session-only consent, no participant attribution, no raw persistence and exact-media-ID boundary.
- **Release target:** **V0.11.5**.
- **Pre-CI score:** **9.3/10**. Remaining score is full Node/package/PWA + PHP regression proof, merge, post-merge checks and direct V0.11.5 ZIP/SHA verification.

## Exact next action
Run the final V0.11.5 manifest/static review, open the 11F PR, execute the complete Node/package/PWA + PHP gates, repair only demonstrated failures, merge when green, verify V0.11.5 release assets/checksum, then begin **11G — Spatial Interaction V2** from current main.

Representative physical camera/microphone acceptance remains separate from CI.
