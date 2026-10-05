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
- **12F — Multi-Room / Handoff Intelligence** — PR #60 merged at `f13168c9b5f338fac73d3d653679865ad339429e`. V0.12.5 post-merge green. **10/10**.
- **12G — Advanced Spatial + Audio Source Intelligence** — PR #61 merged at `306c9c7007b29253a874d421c602fcf0906f9867`. V0.12.6 post-merge Node/package/PWA + PHP green and deploy artifact verified. **10/10**.
- Physical camera/microphone representative-device evidence remains separate from CI.

## Active section: 12H — Agent Multimodal Reasoning
- **Branch:** `feat/v012h-agent-multimodal-reasoning`.
- **Audited baseline:** **7.7/10**. AGENT already consumed canonical dialogue scope, owner-approved participant memory and meeting reply policy, but there was no single bounded reasoning contract telling AGENT which multimodal evidence it could use and when participant-specific context must be withheld.
- Added pure `src/agent-multimodal-context.js` for canonical speaker state, evidence labels, participant-name authorization, participant-memory authorization, meeting context, spatial/audio context and proactive eligibility.
- **No identity override:** AGENT context exposes `identityOverrideAllowed:false`. It cannot create, replace, merge or reinterpret canonical participant identity.
- Clean verified canonical speaker turns may use the verified participant name and that participant's owner-approved memory.
- Unknown, revoked, overlapping/partial, or identity-conflicted turns remain conversationally usable but receive **no participant name and no participant-specific owner memory**.
- Canonical identity conflict is surfaced as uncertainty; AGENT is explicitly instructed not to resolve the conflict itself.
- Diarization overlap and partial multi-person attribution remain unresolved in reasoning context; AGENT may not collapse them to one speaker identity.
- Spatial/audio direction, calibrated distance/bearing and source conflicts are supplied only as labeled context and are explicitly not identity proof.
- Meeting context is bounded to meeting ID/status/title/policy and remains subordinate to the existing `meetingAgentReplyPolicy`.
- The optional local Ollama system prompt now includes bounded canonical multimodal reasoning lines and an explicit instruction never to override canonical identity, speaker attribution, participant records or owner corrections.
- Local scripted replies use the same participant-name/memory gates as the local model path.
- Participant-specific proactive conversation follow-ups now require the 12H canonical reasoning eligibility gate; unknown/conflicted/overlap/revoked/meeting-scoped turns do not create those follow-ups.
- AGENT UI now exposes a visible `Reasoning context` status line showing bounded speaker state, memory isolation/authorization, meeting state and evidence labels.
- Release target: **V0.12.7** with package/PWA/runtime-audit/deploy-manifest wiring.
- Deterministic fixtures cover verified/unknown speaker behavior, conflict handling, overlap, memory isolation, spatial/audio context, meeting context, proactive suppression, revocation, summary privacy, local-model prompting, visible reasoning status and no identity/storage/sensor/network authority in the pure core.
- **Pre-CI score: 9.7/10.** Remaining 0.3 is full Node/package/PWA + PHP proof, PR merge, post-merge verification and V0.12.7 artifact validation.

## Exact next action
Open the 12H PR, repair only demonstrated failures, merge when all required checks are green, verify post-merge V0.12.7 packaging, score 12H **10/10**, then begin **12I — Long-Session / Stress Hardening** from merged main.
