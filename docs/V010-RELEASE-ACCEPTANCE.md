# Tracky2 V0.10 — Final standalone release acceptance

This document separates the **software delivery gate** from **representative physical-device acceptance**. Tracky2 V0.10 remains a standalone browser/PWA + optional PHP/SQLite application. It does not depend on VP3 Cloud or HomeServer.

## Software delivery gate

A V0.10 release build is software-green only when all of the following are true:

| Gate | Required evidence |
| --- | --- |
| Deterministic Node regression | `npm run validate` passes, including V0.10A–10J privacy, identity, audio, task, memory, sync, UI and resilience contracts. |
| PHP fresh install | PHP syntax/extensions, first-owner install, CSRF/session/role behavior and encrypted provider/participant storage pass. |
| PHP upgrade | Legacy schema migration encrypts existing participant profiles, preserves data and is idempotent. |
| Browser/server sync | Version conflicts/tombstones and explicit conflict resolution pass; no conversation/ROOM/task/memory data is silently synchronized. |
| Backup/recovery | Backup create/verify/restore passes with DB + original instance key and a pre-restore recovery point. |
| Release package | Direct deployment ZIP contains every runtime module/doc, passes package smoke and has a published SHA-256 sidecar. |
| Runtime resilience | Bounded granted-only camera/microphone recovery, aggregate long-run budgets, permission lifecycle and storage-pressure behavior pass deterministic tests. |

Passing these gates makes the software delivery gate **10/10**. It does not certify unknown cameras, microphones, browsers or operating systems.

## Representative-device matrix

Use `diagnostics.html` and `docs/hardware-acceptance.md`. Every representative configuration should record:

| Check | Pass condition |
| --- | --- |
| Camera transport/tracking | Camera permission works, both marker colors cover all four sections, acceptable FPS/confidence and reviewed dropout/jump counts. |
| Microphone transport | Permission works and nonzero level is measured; no claim about speaker-recognition accuracy is made from this test alone. |
| Camera interruption | Already-granted camera is interrupted/restored; bounded automatic recovery or clear manual fallback occurs without fake participant departure. |
| Microphone interruption | Already-granted microphone is interrupted/restored; bounded recovery or clear manual fallback occurs without inferring silence. |
| Permission revoke/restore | Denied/prompt state is not background-reprompted; granted state may resume bounded recovery. |
| Foreground lifecycle | Background-tab suspension is excluded from active runtime-stall counts; pending recovery resumes only in foreground. |
| Long session | Representative AGENT workload runs at least 20 minutes; aggregate stalls, room-scan latency and audio queue depth are reviewed. |
| Restart integrity | Reload/restart does not fabricate historical presence, speech, task outcomes or resurrect revoked memory. |
| Storage pressure | Critical reported storage pressure pauses optional ROOM-history writes only; live operation and existing data remain intact. |
| Participant/privacy | Identity/voice behavior stays consented and conservative; participant meter shows only post-verified speech segments. |

A completed matrix is evidence for the tested configuration only.

## Runtime resilience policy

Automatic media recovery is conservative by design:

- maximum **3 attempts per 2-minute window** for each sensor;
- automatic retry only when the Permissions API reports the sensor as already **granted**;
- no background retry while the page is hidden;
- no automatic retry after an explicit manual stop;
- retry permission is rechecked immediately before hardware access;
- after budget exhaustion, recovery becomes manual.

Runtime-health monitoring stores aggregate counters only: frame-gap/stall counts, room-scan durations and maximum audio queue depth. It does not retain media frames or samples.

Browser storage is classified as healthy below 75% of reported quota, warning from 75% to below 90%, and critical at 90% or above. At critical pressure, only optional ROOM-history persistence pauses. Tracky2 does not automatically delete existing participant, dialogue, task, memory, scene or server data.

## Explicit V0.10 limitations

V0.10 does **not** claim:

- calibrated real-world distance or a measured floor plan from camera-relative rectangles;
- isolated live per-person microphone waveform from one shared microphone;
- identification of music, television, coughing, illness, sleep, emotion or other sound/health states from acoustic energy;
- universal hardware certification from GitHub CI or one device report;
- unattended sensor permission prompts;
- Cloud/HomeServer synchronization;
- advanced media identification, calibrated spatial audio or dedicated video-meeting intelligence.

Those require separate scoped evidence, consent and acceptance work.
