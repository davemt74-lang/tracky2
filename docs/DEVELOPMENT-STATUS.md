# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V011-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. Tracky2 V0.11 remains standalone: no VP3 Cloud or HomeServer integration.

## Completed and verified
- **V0.10A–10J** — completed/merged with their published releases and software delivery gates.
- **V0.11 planning** — PR [#43](https://github.com/davemt74-lang/tracky2/pull/43), merged `4844af4d13fd166ae0f59923500dfa9000dcdc9e`. Standalone V0.11 master plan and 11A audit. CI green.
- **11A — Conversation & Listening Engine V2** — PR [#44](https://github.com/davemt74-lang/tracky2/pull/44), merged `13fba900ee0190e6234ccde5be79123f70d798c5`. One canonical room microphone, explicit listening lifecycle, segment deadlines/backpressure, generation cancellation, canonical-save-before-reply ordering and safe reply supersession. Required and post-merge Node/PHP checks passed. V0.11.0 deploy SHA-256 `90380e2d31b625af42d588acc4d3636647b54e436a29d494a227ee1f32bf1539`. Software delivery **10/10**.

## Active section: 11B — Speaker & Participant Tracking V2
- **Branch:** `feat/v011b-speaker-participant-v2`, based on verified 11A main.
- **Audited baseline:** **7.6/10** before implementation. Existing face/body tracking, voice-profile matching, visitor context and ambiguity handling were conservative, but canonical turns lacked one explicit association/provenance contract and occluded body memory could be treated too strongly as live body evidence.
- **Speaker authority:** verified voice profile remains authoritative for speaker identity. Visual evidence may support or contradict the voice result but never converts proximity/body context into speaker identity.
- **Association states:** `verified-voice+face-body`, `verified-voice+body`, `verified-voice-only`, `verified-voice-visual-conflict`, `ambiguous-voice`, `unknown-nearby-participant`, `unknown-nearby-visitor`, and `unknown-speaker`.
- **Live-vs-memory rule:** current `matched` face/body or `body-lock` can support a verified voice. `occluded` / body-memory evidence is recorded as historical visual context and never counts as current body confirmation.
- **Conflicts:** if a verified voice says Participant A while current enrolled visual identity shows only another participant, Tracky2 keeps A as voice-verified but labels the evidence `VOICE VERIFIED · VISUAL CONFLICT`.
- **Ambiguity/context:** ambiguous or unmatched shared-mic speech never receives a participant ID. A sole visible participant/visitor may be recorded only as unverified context; multiple visible people remove even that shortcut.
- **Transitions:** accepted canonical turns may record `speaker-verified`, `speaker-handoff`, `speaker-became-unverified`, `visual-track-handoff`, or evidence transitions. Transition state is previewed before save and committed only after the canonical turn saves and remains current.
- **Privacy:** the unverified transition log never attributes the event to the previous participant. No speaker identity is carried automatically from a prior turn.
- **Revocation:** removal of the participant record or disabling that participant's voice recognition clears the current speaker association and transition memory.
- **UI:** ROOM exposes speaker link + provenance; recent participant cards show their last verified association; Conversation displays the canonical speaker-link label alongside each transcript.
- **Tests:** deterministic face/body, body-lock, occlusion, duplicate visual evidence, voice/visual conflict, ambiguous voice, sole participant/visitor context, multi-person unknown, handoff, revocation, canonical-turn provenance, snapshot privacy and no-new-media-path fixtures.
- **Release target:** **V0.11.1**.
- **Gate remaining:** full Node/package/PWA + PHP regression → repair only demonstrated failures → PR merge → post-merge checks → direct V0.11.1 ZIP + SHA-256 verification. Only then score 11B software delivery **10/10** and begin 11C.

## Exact next action
Open the 11B PR, run the complete existing regression/package/PHP gates, fix only demonstrated failures, merge when all required checks are green, verify V0.11.1 release assets/checksum, then start **11C — Transcription Intelligence V2** from current main.

Representative physical camera/microphone acceptance remains separate from CI.
