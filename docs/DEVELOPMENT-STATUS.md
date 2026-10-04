# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V011-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. Tracky2 V0.11 remains standalone: no VP3 Cloud or HomeServer integration.

## Completed and verified
- **V0.10A–10J** — completed/merged with their published releases and software delivery gates.
- **V0.11 planning** — PR [#43](https://github.com/davemt74-lang/tracky2/pull/43), merged `4844af4d13fd166ae0f59923500dfa9000dcdc9e`. Standalone V0.11 master plan and 11A audit. CI green.
- **11A — Conversation & Listening Engine V2** — PR [#44](https://github.com/davemt74-lang/tracky2/pull/44), merged `13fba900ee0190e6234ccde5be79123f70d798c5`. V0.11.0 deploy SHA-256 `90380e2d31b625af42d588acc4d3636647b54e436a29d494a227ee1f32bf1539`. Software delivery **10/10**.
- **11B — Speaker & Participant Tracking V2** — PR [#45](https://github.com/davemt74-lang/tracky2/pull/45), merged `ad0558620de5e3bc1b8adec46e9d2f65e918b581`. Required and post-merge Node/PHP jobs passed. V0.11.1 deploy SHA-256 `a3bddb1a51159e64503bd6a8d0afc59b6acc496efbd1cb39804033e93fdc2174`. Software delivery **10/10**.
- **11C — Transcription Intelligence V2** — PR [#46](https://github.com/davemt74-lang/tracky2/pull/46), merged `286f9b6b6d249a14b78dee61886bf89edb37ed7a`. Required and post-merge Node/PHP jobs passed. V0.11.2 deploy SHA-256 `6305fcaeac2c747c11d972cb4512703d9575db7eda1547c28aa4d2ba615e4b80`. Canonical transcript lifecycle/provenance, correction, session search/export and privacy boundaries. Software delivery **10/10**.

## Active section: 11D — Multi-Participant Conversation
- **Branch:** `feat/v011d-multi-participant-conversation`, based on verified 11C main.
- **Audited baseline:** **6.9/10** before implementation. Existing turns had verified speaker identity and camera-relative group IDs, but group IDs were snapshot-local, prior model context flattened different speakers, AGENT had no explicit human-vs-agent addressee policy, and group/solo privacy scopes were not first-class canonical fields.
- **Canonical multi-party fields:** each accepted turn now records schema version, verified/unverified/ambiguous ownership, group size, verified participant/visitor membership, deterministic known-group scope, explicit addressee metadata, AGENT attention target and evidence-driven overlap state.
- **Addressee rule:** only explicit vocatives/tags count (for example `Sam, ...`, `... , Sam?`, `@Sam`, `Agent, ...`). Casual name mentions do not become addressee claims. Trailing names require explicit punctuation.
- **AGENT attention:** in a multi-person group, AGENT abstains unless explicitly addressed. A turn explicitly addressed to another participant also causes abstention and may cancel a pending AGENT response. Solo conversation keeps the existing conversational behavior.
- **Ambiguity/overlap:** ambiguous voice ownership is represented as ambiguous ownership, **not** invented overlap. Overlap state becomes `overlap-observed` only when explicit overlap evidence exists; either unresolved multi-person ownership or overlap evidence causes AGENT abstention.
- **Context windows:** prior participant turns are speaker-labeled and same-session. Multi-person context requires the exact canonical conversation scope, so Pat+Sam cannot pull Pat-only or Pat+Lee turns.
- **Anonymous groups:** labels such as `scope:unknown-group-2` are audit/display only and are never reused to retrieve AGENT history across later unidentified people.
- **Memory privacy:** durable participant memory is loaded only for the **current verified speaker**. Memory is never loaded for a named addressee, visible neighbor, visitor or other group participant.
- **AGENT history:** saved AGENT replies carry bounded conversation scope metadata and are retrieved only for that known scope. Legacy unscoped history is permitted only for a matching solo verified participant.
- **UI:** ROOM exposes conversation attention/group size; transcript bubbles show attention/addressee/overlap state; model context labels verified speakers without changing canonical transcript ownership.
- **Runtime invariants:** still one `RoomAudioCapture`, one speaker association path, one local transcription path and one canonical IndexedDB dialogue store. No diarization or source separation is claimed.
- **Review fixes:** rebuilt a corrupted duplicated core module; repaired trailing-vocative parsing; exact-scoped multi-person history; separated ambiguity from overlap; blocked anonymous-scope history reuse.
- **Tests:** deterministic two/three-person speaker/addressee behavior, explicit AGENT address, human-directed abstention, ambiguous ownership, explicit overlap evidence, exact group-scope privacy, anonymous history isolation, saved reply scope, speaker-labeled model context, current-speaker-only memory and no-new-media-path fixtures.
- **Release target:** **V0.11.3**.
- **Pre-CI score:** **9.4/10**. Remaining score is full regression/package/PHP proof, merge and release verification.

## Exact next action
Open the 11D PR, run the complete Node/package/PWA + PHP regression gates, repair only demonstrated failures, merge when all required checks are green, verify V0.11.3 ZIP/SHA-256, then begin **11E — Dedicated Video Meeting Runtime** from current main.

Representative physical camera/microphone acceptance remains separate from CI.
