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
- **11G — Spatial Interaction V2** — PR [#50](https://github.com/davemt74-lang/tracky2/pull/50), merged `b4498bccff4371a7068cbaf6603f936afe433233`. Required/post-merge Node/PHP jobs passed. V0.11.6 SHA-256 `640af4c46af2ba563bd6b22fcd61a02d63bcc662d8275d061f91954bfc21c96b`. Explicit owner floor-plane calibration with approximate planar position/distance/bearing; camera-relative fallback remains canonical without calibration. **10/10**.

## Active section: 11H — Proactive Interactive Agent V2
- **Branch:** `feat/v011h-proactive-interactive-agent-v2`, based on verified 11G main.
- **Audited baseline:** **7.3/10**. Existing cognitive loop was safe/explainable but limited to verified-arrival greetings.
- **Architecture:** new pure `src/agent-proactive-core.js` governs opportunities only. It does not open media, transcribe, execute skills or create a second conversation/task runtime.
- **Opportunity types:** verified-conversation follow-up, approved-task status notice and meeting-ended summary notice. Task retry scheduling is explicitly excluded.
- **Attention:** proactive speech requires a currently visible verified attention target. Participant-specific follow-ups require that participant to remain visible; general notices require exactly one verified visible participant.
- **Participant preference:** additive `agentProactiveEnabled` participant field defaults on and is editable in Participant Settings. Turning it off blocks proactive follow-ups/status notices for that participant without changing face/voice consent.
- **Interruption governance:** session policy provides global enable, follow-up enable, 30/60/120-second delay and 1/3/5-per-hour budget. Quiet hours apply to all automatic engagement.
- **Shared budget:** successful automatic greetings are recorded into the same proactive interruption budget; disabling proactive follow-ups does not disable the existing greeting control.
- **Dependencies/abstention:** hidden page, quiet hours, active meeting, active conversation/AGENT speech, participant opt-out, missing/ambiguous attention target, active task dependency, cooldown and hourly budget all produce deterministic abstention/wait/cancel reasons.
- **Follow-up lifecycle:** verified canonical dialogue replaces older follow-up in the same conversation scope. Newer dialogue supersedes stale follow-up. Opportunities expire, dedupe and are session-only.
- **Task boundary:** tasks retain the 10F owner-confirmation/execution path. 11H only listens to canonical task outcome events and never calls task executors.
- **Meeting boundary:** active meetings suppress proactive interruptions. The existing meeting-ended canonical event may offer a summary-ready notice after the meeting is no longer active.
- **AGENT integration:** `proactiveSpeak()` reuses the existing `say()` path and refuses while voice enrollment, model response, current speech or meeting activity is active.
- **Privacy/deletion:** participant removal scrubs pending opportunities, participant cooldown state, interruption references and participant-linked last decision in memory.
- **Tests:** deterministic opportunity creation, dedupe, expiry, quiet/meeting/busy/visibility gates, participant opt-out, attention, task dependency, conversation supersession, cooldown/hourly budgets, shared greeting budget, deletion cleanup, no-auto-task and no-new-media-path fixtures.
- **Release target:** **V0.11.7**.
- **Pre-CI score:** **9.5/10**. Remaining score is full Node/package/PWA + PHP regression proof, PR merge, post-merge verification and direct V0.11.7 ZIP/SHA validation.

## Exact next action
Run the final V0.11.7 manifest/static review, open the 11H PR, execute the complete Node/package/PWA + PHP gates, repair only demonstrated failures, merge when green, verify V0.11.7 release assets/checksum, then begin **11I — Session Recall, Search & Explainability** from current main.

Representative physical camera/microphone acceptance remains separate from CI.
