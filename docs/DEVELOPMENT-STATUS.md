# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V011-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. Tracky2 V0.11 remains standalone: no VP3 Cloud or HomeServer integration.

## Completed and verified
- **V0.10A–10J** — completed/merged with their published releases and software delivery gates.
- **V0.11 planning** — PR [#43](https://github.com/davemt74-lang/tracky2/pull/43), merged `4844af4d13fd166ae0f59923500dfa9000dcdc9e`. Standalone V0.11 master plan. CI green.
- **11A — Conversation & Listening Engine V2** — PR [#44](https://github.com/davemt74-lang/tracky2/pull/44), merged `13fba900ee0190e6234ccde5be79123f70d798c5`. V0.11.0 SHA-256 `90380e2d31b625af42d588acc4d3636647b54e436a29d494a227ee1f32bf1539`. **10/10**.
- **11B — Speaker & Participant Tracking V2** — PR [#45](https://github.com/davemt74-lang/tracky2/pull/45), merged `ad0558620de5e3bc1b8adec46e9d2f65e918b581`. V0.11.1 SHA-256 `a3bddb1a51159e64503bd6a8d0afc59b6acc496efbd1cb39804033e93fdc2174`. **10/10**.
- **11C — Transcription Intelligence V2** — PR [#46](https://github.com/davemt74-lang/tracky2/pull/46), merged `286f9b6b6d249a14b78dee61886bf89edb37ed7a`. V0.11.2 SHA-256 `6305fcaeac2c747c11d972cb4512703d9575db7eda1547c28aa4d2ba615e4b80`. **10/10**.
- **11D — Multi-Participant Conversation** — PR [#47](https://github.com/davemt74-lang/tracky2/pull/47), merged `e5fbc82a3fb7293972404f26e8fcd7b6c8802305`. V0.11.3 SHA-256 `135a2bc307c1a1e566a86d0e9105da8e0ef0d60a41defa1282ca7a0065b116c4`. **10/10**.
- **11E — Dedicated Video Meeting Runtime** — PR [#48](https://github.com/davemt74-lang/tracky2/pull/48), merged `a895edaec95909bbfce7cc8a422d0905a35bb9fc`. V0.11.4 SHA-256 `d25ac8cc02292a04b3d51e0230a2d4883ef305aa9fd28dc5ac2b2e07736a8a31`. **10/10**.
- **11F — Environmental / Media Audio Intelligence** — PR [#49](https://github.com/davemt74-lang/tracky2/pull/49), merged `a04181ab402cd4788b10c63c1fe9c12bb1fbb626`. V0.11.5 SHA-256 `69f064b3e25b65e85cac0838dab279847e3d53515eb939fdb3bca5e7da144ba1`. **10/10**.
- **11G — Spatial Interaction V2** — PR [#50](https://github.com/davemt74-lang/tracky2/pull/50), merged `b4498bccff4371a7068cbaf6603f936afe433233`. V0.11.6 SHA-256 `640af4c46af2ba563bd6b22fcd61a02d63bcc662d8275d061f91954bfc21c96b`. **10/10**.
- **11H — Proactive Interactive Agent V2** — PR [#51](https://github.com/davemt74-lang/tracky2/pull/51), merged `1afb13228362b9c83bb729b4204eeac5dd8a9977`. V0.11.7 SHA-256 `496962336a954a3eeadbd5177669e686b72d6aa48c78b47df7c1a69511f1911d`. Required/post-merge Node/PHP checks passed. **10/10**.

## Active section: 11I — Session Recall, Search & Explainability
- **Branch:** `feat/v011i-session-recall-search`, based on verified 11H main.
- **Audited baseline:** **7.5/10**. Canonical dialogue, effective ROOM events, meeting metadata, task metadata and owner memory already existed, but search was fragmented by feature and there was no single provenance/stale-reference view.
- **Architecture:** new pure `src/session-recall-core.js` builds an **ephemeral in-memory projection at search time**. New `src/session-recall-ui.js` reads existing stores and renders results. No IndexedDB object store, localStorage index or duplicated durable recall database is created.
- **Conversation sources:** current canonical dialogue turns plus the existing AGENT/system reply history. Historical duplicated participant speech in AGENT history remains excluded.
- **ROOM sources:** current + optionally persisted ROOM records are de-duplicated by event ID and passed through the existing canonical ROOM correction projection. Retracted events disappear; replacement wording becomes the searchable wording.
- **Meeting sources:** meeting metadata, owner notes, decisions and action items are searched from existing meeting records. Decision source text is resolved dynamically from the current canonical transcript; corrected wording propagates automatically on the next search/refresh.
- **Task sources:** existing local task metadata is searched in place. `relatedEventId` is resolved against effective ROOM events; missing/retracted/pruned sources are labeled stale rather than reconstructed.
- **Memory sources:** active owner-authored memory only. Revoked and expired memory is excluded. Session-only owner memory is included from the existing in-memory ledger without forcing persistence.
- **Participant scope:** selecting a participant is strict: only references explicitly linked to that participant are returned. Unrelated participant-specific records and unscoped records are not leaked into the scoped result set.
- **Decision scope:** cross-source Decisions filter includes canonical ROOM decisions/actions/outcomes and owner-marked meeting decisions.
- **Explainability:** each result exposes source type, subtype, current/historical scope, current status, provenance and reference availability. Missing references are shown as stale; recall never silently reconstructs missing source content.
- **Deletion/correction propagation:** participant deletion, dialogue deletion, ROOM retraction, memory revocation/expiry and meeting participant scrubbing are reflected because the projection is rebuilt from current sources on every search/refresh.
- **UI:** AGENT tab adds Recall, search & provenance with query, source, participant and temporal filters, Show recent/Refresh controls, and per-result “Why this result” evidence.
- **Tests:** corrected transcript, ROOM replace/retract, memory revoke/expiry, strict participant scope, stale meeting/task references, decision filtering, AGENT reply history, no-persistent-index and explainability fixtures.
- **Release target:** **V0.11.8**.
- **Pre-CI score:** **9.5/10**. Remaining score is full Node/package/PWA + PHP regression proof, PR merge, post-merge verification and direct V0.11.8 ZIP/SHA validation.

## Exact next action
Run the final V0.11.8 manifest/static review, open the 11I PR, execute the complete Node/package/PWA + PHP gates, repair only demonstrated failures, merge when green, verify V0.11.8 release assets/checksum, then begin **11J — V0.11 Resilience & Release** from current main.

Representative physical camera/microphone acceptance remains separate from CI.
