# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V011-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. Tracky2 V0.11 remains standalone: no VP3 Cloud or HomeServer integration.

## Completed and verified
- **V0.10A–10I** — completed/merged with their published releases and delivery gates.
- **10J** — PR [#42](https://github.com/davemt74-lang/tracky2/pull/42), merged `f86ac3ebff7d52d8e96037b3b9f8b97f2028b5cb`. Final V0.10 resilience/release hardening. Required and post-merge Node/PHP jobs passed. V0.10.9 deploy SHA-256 `c5c7e1f803f5b2a80ea248fbf5df9dc917178b1e06845f3e460add2850b31087`. Software delivery gate **10/10**; representative physical-device acceptance remains separate.
- **V0.11 planning** — PR [#43](https://github.com/davemt74-lang/tracky2/pull/43), merged `4844af4d13fd166ae0f59923500dfa9000dcdc9e`. Standalone V0.11 master plan and 11A deep audit. Required and post-merge CI passed.

## Active section: 11A — Conversation & Listening Engine V2
- **Branch:** `feat/v011a-conversation-listening-v2`, based on verified V0.11 planning main.
- **Audited baseline:** **7.4/10** before implementation.
- **Single-capture invariant:** existing `RoomAudioCapture` remains the only live room microphone. Voice Profile enrollment stays a separate explicit enrollment tool, not a competing listening path.
- **Listening contract:** new pure `src/conversation-listening-core.js` owns segment IDs, generation, queue/result deadlines, deterministic oldest-first overflow, stale-work pruning, cancellation counts and explicit listening states.
- **Backpressure:** maximum live listening backlog defaults to 4 queued segments; queue-age deadline is 8 seconds and result deadline is 45 seconds. Stale/superseded work is discarded before it can become a transcript or AGENT reply.
- **Lifecycle:** ROOM now exposes listening/offline/speech/queued/processing/suppressed/agent-speaking/recovering state plus queue depth, drops and last transition.
- **TTS boundary:** existing microphone suppression is preserved and now explicitly represented in listening state. 11A does not claim simultaneous full-duplex source separation.
- **Canonical dialogue ordering:** accepted turns are persisted to the existing IndexedDB dialogue store and revalidated before being appended to live dialogue or handed to AGENT. Persistence failure skips the AGENT reply.
- **Reply policy:** stale turns, modal state, active AGENT speech and short cooldowns abstain. A newer accepted turn supersedes an older in-flight model response. Only a verified, explicit stop command may cancel AGENT speech/reply state.
- **Model cancellation:** each local-model request owns its AbortController; superseded requests cannot clear or overwrite newer pending-response state.
- **Recovery integration:** audio start/stop/generation invalidation and bounded microphone recovery update the listening state rather than maintaining a parallel queue.
- **Tests:** deterministic segment/deadline, overflow, stale/generation cancellation, edge-trigger state, verified stop intent, pending-reply supersession, canonical-save-before-reply and single-room-microphone integration fixtures are on branch.
- **Release target:** **V0.11.0**. Package/PWA/audit/deploy manifests include `conversation-listening-core.js` and `docs/V011-MASTER-PLAN.md`.
- **Gate remaining:** full Node/package/PWA + PHP regression → repair only demonstrated failures → PR merge → post-merge checks → direct V0.11.0 ZIP + SHA-256 verification. Only then score 11A software delivery **10/10** and begin 11B.

## Exact next action
Open the 11A PR, run the full existing regression/package/PHP gates, fix only demonstrated failures, merge after all required checks pass, verify the V0.11.0 release assets/checksum, then start **11B — Speaker & Participant Tracking V2** from current main.

Representative physical camera/microphone acceptance remains separate from CI.
