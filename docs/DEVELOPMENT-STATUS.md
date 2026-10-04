# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V011-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. Tracky2 V0.11 remains standalone: no VP3 Cloud or HomeServer integration.

## Completed and verified
- **V0.10A–10J** — completed/merged with their published releases and software delivery gates.
- **V0.11 planning** — PR [#43](https://github.com/davemt74-lang/tracky2/pull/43), merged `4844af4d13fd166ae0f59923500dfa9000dcdc9e`. Standalone V0.11 master plan. CI green.
- **11A — Conversation & Listening Engine V2** — PR [#44](https://github.com/davemt74-lang/tracky2/pull/44), merged `13fba900ee0190e6234ccde5be79123f70d798c5`. V0.11.0 deploy SHA-256 `90380e2d31b625af42d588acc4d3636647b54e436a29d494a227ee1f32bf1539`. **10/10**.
- **11B — Speaker & Participant Tracking V2** — PR [#45](https://github.com/davemt74-lang/tracky2/pull/45), merged `ad0558620de5e3bc1b8adec46e9d2f65e918b581`. V0.11.1 deploy SHA-256 `a3bddb1a51159e64503bd6a8d0afc59b6acc496efbd1cb39804033e93fdc2174`. **10/10**.
- **11C — Transcription Intelligence V2** — PR [#46](https://github.com/davemt74-lang/tracky2/pull/46), merged `286f9b6b6d249a14b78dee61886bf89edb37ed7a`. V0.11.2 deploy SHA-256 `6305fcaeac2c747c11d972cb4512703d9575db7eda1547c28aa4d2ba615e4b80`. **10/10**.
- **11D — Multi-Participant Conversation** — PR [#47](https://github.com/davemt74-lang/tracky2/pull/47), merged `e5fbc82a3fb7293972404f26e8fcd7b6c8802305`. Required and post-merge Node/PHP jobs passed. V0.11.3 deploy SHA-256 `135a2bc307c1a1e566a86d0e9105da8e0ef0d60a41defa1282ca7a0065b116c4`. Exact group-scope privacy, explicit addressee/attention rules, current-speaker-only memory and conservative overlap handling. **10/10**.

## Active section: 11E — Dedicated Video Meeting Runtime
- **Branch:** `feat/v011e-video-meeting-runtime`, based on verified 11D main.
- **Audited baseline:** **6.8/10** before implementation. There was no meeting subsystem; 11A–11D already provided the canonical camera/audio/speaker/transcript/multi-party foundations.
- **Architecture:** Meeting mode is a presentation/runtime layer over the existing AGENT camera, single `RoomAudioCapture`, speaker association, transcript lifecycle and canonical IndexedDB dialogue store. No second media/transcription path exists.
- **Lifecycle/history:** IndexedDB v8 adds a bounded `meetings` metadata store. Meetings persist active/ended lifecycle, title, start/end time, AGENT policy, verified roster IDs, unverified counts, owner notes, decision references and action-item metadata. Reload resumes an active meeting from the same local store.
- **One-active-meeting rule:** `saveMeeting` enforces one active meeting transactionally, including across tabs sharing the same browser profile.
- **Canonical transcript boundary:** meeting turns are selected by `meetingId` from canonical dialogue records. Transcript text is never copied into meeting metadata; owner transcript corrections/deletions therefore flow through meeting history automatically.
- **Roster:** current non-occluded room tracks update verified joins/leaves plus aggregate unverified counts. Roster history stores participant IDs only, never images/embeddings/media.
- **Decisions/notes/actions:** notes are owner-authored; decisions store canonical source-turn IDs plus optional owner wording; action items are owner-authored with optional source-turn and assignee provenance. Participant deletion scrubs roster/event/assignee metadata without deleting the meeting.
- **AGENT participation:** meeting policy is `listen-only` by default or `when-addressed`. Meeting policy is checked before multi-party reply policy. Meeting boundary changes cancel in-flight AGENT replies and automatic greetings abstain during active meetings.
- **Late-turn safety:** segments captured during a meeting keep that meeting ID through canonical persistence. Replies are suppressed if the active meeting changed or ended before reply time.
- **UI:** dedicated Meeting tab, direct `?mode=meeting` entry, start/end/policy controls, live roster, canonical turn view, owner notes, decision markers, action items, meeting history and deterministic post-meeting summary.
- **Privacy/deletion:** participant deletion includes meeting metadata scrub in the same IndexedDB transaction. Meeting deletion removes meeting metadata only; canonical transcripts remain untouched.
- **Tests:** meeting lifecycle, roster joins/leaves, reload/static persistence, canonical correction/deletion propagation, notes/decision/action provenance, deterministic summary, AGENT policy/late replies, participant scrub, IndexedDB v8 privacy, one-active-meeting enforcement, tab accessibility and no-new-media-path fixtures.
- **Release target:** **V0.11.4**.
- **Pre-CI score:** **9.3/10**. Remaining score is full Node/package/PWA + PHP regression proof, merge, post-merge checks and direct V0.11.4 ZIP/SHA verification.

## Exact next action
Open the 11E PR after the final manifest/static review, run the complete Node/package/PWA + PHP gates, repair only demonstrated failures, merge when green, verify V0.11.4 release assets/checksum, then begin **11F — Environmental / Media Audio Intelligence** from current main.

Representative physical camera/microphone acceptance remains separate from CI.
