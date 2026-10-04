# Tracky2 V0.10 — Representative-device release acceptance

This checklist must be completed on real cameras and microphones. GitHub CI validates deterministic software behavior and packaging; it cannot certify physical hardware, browser drivers, acoustics, lighting, thermal behavior, or permission UI.

## Automated self-test evidence

1. Serve Tracky2 on localhost or HTTPS and open `diagnostics.html`.
2. Explicitly allow a supported camera. Hold the green marker, then the blue marker, in each of the same four vertical gameboard sections. Keep the test active for at least eight seconds.
3. Review measured FPS, confidence, stable-frame coverage, dropouts, rejected jumps and the aggregate runtime-stall counter. The report stores counters only, never frames.
4. Run the microphone transport test and speak normally. Confirm access and a nonzero peak signal. This test does not record or transcribe audio and does not validate speaker identification.
5. Use **Refresh permission & storage health** and review the browser-reported camera/microphone permission state plus aggregate storage-pressure state.

## Participant / AGENT functional acceptance

1. Enroll at least two consenting participants on `participants.html`. Voice Profiles remain optional and require their separate enrollment process.
2. Confirm face recognition when each participant faces the camera and conservative full-body continuity when they turn away or are briefly occluded.
3. Confirm participant audio cards react only after a speech segment passes the voice-profile and signal gate. Shared room noise must remain in ROOM, not animate a participant meter.
4. Confirm optional transcription creates canonical dialogue turns and owner corrections retain the original wording/revision trail.
5. Confirm the AGENT greeting/cognitive loop abstains for unknown people, quiet hours, opt-out and busy voice states.
6. Confirm allowlisted tasks still require explicit confirmation and that cancelled/failed tasks do not fabricate successful outcomes.
7. Confirm revoked/expired participant memory is not supplied to AGENT.

## Resilience and lifecycle acceptance

Check each matching item in the diagnostics page only after observing it on the representative device:

- **Camera recovery:** interrupt an already-granted camera (device disconnect or browser/device disable), restore it, and verify Tracky2 either recovers within its bounded retry budget or clearly requires manual Start camera. The outage must not manufacture a participant departure.
- **Microphone recovery:** interrupt an already-granted microphone, restore it, and verify bounded recovery or clear manual fallback. The outage must not be recorded as room silence.
- **Permission lifecycle:** revoke and restore camera/microphone permission. Tracky2 must not background-reprompt a denied or prompt-state permission. Automatic retry is allowed only for an already-granted permission.
- **Foreground resume:** background the page, return to it and verify hidden-tab suspension is not counted as an active runtime stall. Pending sensor recovery may resume only when foregrounded.
- **Long session:** run the representative camera/AGENT workload for at least **20 minutes**. Review aggregate runtime stalls, room-scan latency and audio queue depth. Investigate sustained degradation before accepting the device.
- **Restart integrity:** reload/restart and verify Tracky2 does not create a fake historical departure, speech attribution, task outcome, current observation or resurrect revoked memory.
- **Storage pressure:** on a constrained browser profile or test environment, confirm critical reported storage pressure pauses only optional ROOM-history persistence. Live operation must continue, existing data must not be auto-deleted and the owner’s save preference must remain intact.

Automatic sensor recovery is intentionally capped at three attempts per two-minute window. After the retry budget is exhausted, recovery becomes explicit/manual.

## Browser/server recovery acceptance

For self-hosted PHP/SQLite installs:

1. Verify participant synchronization remains manually enabled per participant.
2. Create a server backup with `php server/backup.php create <directory>`.
3. Verify it with `php server/backup.php verify <directory>`.
4. In a maintenance window, test restore on a disposable copy and confirm a pre-restore recovery point is created.
5. Confirm an intentionally conflicting browser/server participant update requires explicit **Keep browser** or **Keep server** resolution.
6. Confirm synced participant profile JSON is encrypted at rest and that losing the original `secret.key` fails closed rather than silently rotating it.

## Report and release decision

Export the diagnostics JSON after review. The report may contain aggregate counters, calibration thresholds, permission states, storage ratio/status, manual checklist state and optional owner-entered notes. It must not contain raw images, audio, transcripts, face embeddings or voice embeddings.

Record the camera model, microphone model, browser/version, operating system, lighting/noise conditions and any issue notes in the optional acceptance notes or your release records. A completed report proves only that the tested representative configuration passed the stated checks.

Do **not** describe V0.10 as universally hardware-certified from CI or from one report. Camera-relative scene areas are not a calibrated floor plan; shared microphone level is not per-person source separation; acoustic patterns do not identify sounds or diagnose health; physical hardware and browser permission behavior remain environment-dependent.
