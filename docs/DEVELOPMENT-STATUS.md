# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V011-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. Tracky2 V0.11 remains standalone: no VP3 Cloud or HomeServer integration.

## Completed and verified
- **V0.10A–10I** — completed/merged with their published releases and delivery gates.
- **10J** — PR [#42](https://github.com/davemt74-lang/tracky2/pull/42), merged `f86ac3ebff7d52d8e96037b3b9f8b97f2028b5cb`. Final V0.10 resilience/release hardening. Required and post-merge Node/PHP jobs passed. V0.10.9 deploy SHA-256 `c5c7e1f803f5b2a80ea248fbf5df9dc917178b1e06845f3e460add2850b31087`. Software delivery gate **10/10**; representative physical-device acceptance remains separate.

## Active program: V0.11 — Standalone Interactive Agent Intelligence
- **Master plan:** `docs/V011-MASTER-PLAN.md`.
- **Independence rule:** standalone browser/PWA + optional self-hosted PHP/SQLite only. Do not add VP3 Cloud, HomeServer, cross-project sync or remote-agent dependencies.
- **Section order:** 11A listening/conversation → 11B speaker/participant tracking → 11C transcription → 11D multi-participant conversation → 11E video meetings → 11F environmental/media audio → 11G spatial interaction → 11H proactive agent → 11I recall/search → 11J release hardening.
- **11A audited baseline:** **7.4/10**. Keep the existing `RoomAudioCapture` microphone, VoiceIdentityEngine, LocalTranscriptionEngine and canonical IndexedDB dialogue pipeline. Missing layer is an explicit listening/turn state machine with segment IDs, age/deadline, deterministic backpressure, cancellation, reply policy and explainable listening health.
- **11A privacy boundary:** no second live microphone, no speaker identity from body proximity, no duplicate transcript store, no weakened TTS feedback suppression. Full simultaneous barge-in/source separation is not claimed in 11A.

## Exact next action
Merge the V0.11 planning/audit PR after green CI. Then create `feat/v011a-conversation-listening-v2` from current main and implement the pure listening state/queue contract first, followed by integration into the existing room-audio pipeline, deterministic tests, V0.11.0 packaging, PR/merge and release verification.
