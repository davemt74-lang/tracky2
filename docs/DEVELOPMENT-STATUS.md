# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V011-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. Tracky2 V0.11 remains standalone: no VP3 Cloud or HomeServer integration.

## Completed and verified
- **V0.10A–10J** — completed/merged with their published releases and software delivery gates.
- **V0.11 planning** — PR [#43](https://github.com/davemt74-lang/tracky2/pull/43), merged `4844af4d13fd166ae0f59923500dfa9000dcdc9e`. Standalone V0.11 master plan and 11A audit. CI green.
- **11A — Conversation & Listening Engine V2** — PR [#44](https://github.com/davemt74-lang/tracky2/pull/44), merged `13fba900ee0190e6234ccde5be79123f70d798c5`. V0.11.0 deploy SHA-256 `90380e2d31b625af42d588acc4d3636647b54e436a29d494a227ee1f32bf1539`. Software delivery **10/10**.
- **11B — Speaker & Participant Tracking V2** — PR [#45](https://github.com/davemt74-lang/tracky2/pull/45), merged `ad0558620de5e3bc1b8adec46e9d2f65e918b581`. Required and post-merge Node/PHP jobs passed. V0.11.1 deploy SHA-256 `a3bddb1a51159e64503bd6a8d0afc59b6acc496efbd1cb39804033e93fdc2174`. Explicit voice-authoritative speaker association, current-vs-memory visual evidence, ambiguity/conflict/handoff provenance and revocation behavior. Software delivery **10/10**.

## Active section: 11C — Transcription Intelligence V2
- **Branch:** `feat/v011c-transcription-v2`, based on verified 11B main.
- **Audited baseline:** **7.3/10** before implementation. Existing local Whisper transcription was revision-pinned, stale-result guarded and canonically correctable, but returned only plain text and had no explicit lifecycle, model/timing provenance, transcript search/export contract or formal partial-state boundary.
- **Single-engine invariant:** existing `LocalTranscriptionEngine` remains the only live transcription path. No second microphone or transcription engine is introduced.
- **Lifecycle:** new pure `src/transcript-lifecycle-core.js` formalizes `pending`, `partial`, `final`, `corrected`, `cancelled` and `unavailable`. Partial hypotheses are memory-only and never canonical storage.
- **Stale-result safety:** transcript work is cancelled when the listening segment generation/deadline is no longer current. Pre-persistence and post-persistence stale checks remain fail-closed; stale saved turns are deleted.
- **Model provenance:** `LocalTranscriptionEngine.transcribeDetailed()` returns source, pinned model ID/revision, processing timing and nullable confidence/language where the current model/API does not expose them.
- **Canonical timing:** saved turns include capture duration, processing duration, transcription completion time and the listening segment ID that defines the transcript boundary.
- **Correction provenance:** owner edits set transcript state to `corrected`, retain the original text/revision chain and preserve original transcription source/model revision. Correction never changes speaker attribution.
- **Storage boundary:** canonical dialogue rejects `pending`, `partial` and `cancelled` transcript states and strips raw-media-shaped fields such as samples/PCM/audio before IndexedDB persistence.
- **Sessions/search:** canonical turns remain grouped by existing room session IDs. Session summaries and case-insensitive canonical transcript search operate directly on the dialogue store without creating a second transcript database.
- **Export:** user-initiated session/all JSON export contains bounded transcript text, speaker verification state and transcript provenance only. It excludes audio, photos, face/voice embeddings and other media/biometrics.
- **UI:** Conversation exposes search, session summary, session/all export controls and transcript lifecycle/model/timing metadata. AGENT conversation uses the same canonical transcript records.
- **Tests:** deterministic partial→final, cancellation, model/timing provenance, speaker-boundary IDs, correction, session grouping, search, export privacy, storage rejection, stale-result ordering and UI integration fixtures are on branch.
- **Release target:** **V0.11.2**.
- **Gate remaining:** full Node/package/PWA + PHP regression → repair only demonstrated failures → PR merge → post-merge checks → direct V0.11.2 ZIP + SHA-256 verification. Only then score 11C software delivery **10/10** and begin 11D.

## Exact next action
Open the 11C PR, run the complete existing regression/package/PHP gates, fix only demonstrated failures, merge when all required checks are green, verify V0.11.2 release assets/checksum, then start **11D — Multi-Participant Conversation** from current main.

Representative physical camera/microphone acceptance remains separate from CI.
