# Tracky2 V0.13 — Representative-device hardware certification

Tracky2 software CI and representative-device certification are two different evidence classes.

- **Software delivery** is proven by deterministic tests, package/PWA validation, PHP foundation checks, merge state and release artifacts.
- **Representative-device certification** is produced by running `diagnostics.html` with a real camera, microphone, browser and operating system.
- A passing representative-device report proves only the tested configuration. It is **not universal hardware certification** and must never be presented as proof that every camera, microphone, browser or computer will behave identically.

The certification workflow never records or exports raw camera frames, raw audio, transcripts, face embeddings, voice embeddings, browser device IDs or raw user-agent strings.

## 1. Certification profile

Open `diagnostics.html` on localhost or HTTPS.

Enter descriptive owner labels for:
- camera;
- microphone;
- test environment;
- lighting;
- ambient noise.

These labels are owner-authored context. Do not paste serial numbers, passwords, account IDs or other secrets.

The report automatically reduces browser/OS information to a coarse runtime profile such as browser family/major version, OS family, device class, secure-context state and locale. The raw user-agent and platform strings are not retained.

## 2. Capability matrix

The diagnostics page reports only bounded capability state:

- camera availability and device count;
- observed camera width/height/frame rate after a successful camera start;
- microphone availability and device count;
- observed microphone channel count and whether stereo input is available;
- `getUserMedia` / `enumerateDevices`;
- Permissions API support;
- browser storage-estimate support;
- AudioWorklet support;
- local-model state when explicitly observable without a network probe.

Unsupported or unknown capabilities must remain explicit. Tracky2 must not fabricate support.

## 3. Camera coverage/performance

1. Start the camera test.
2. Hold the green marker and then the blue marker in each of the four vertical gameboard sections.
3. Keep the test active for at least eight seconds.
4. Review measured FPS, stable-frame coverage, confidence, dropouts and rejected jumps.
5. A camera-coverage **Pass** requires the existing deterministic coverage/performance threshold.

The certification report stores aggregate counters only. It never stores the camera frame.

## 4. Microphone transport and channel capability

Run the microphone test and speak normally.

The test:
- opens one temporary microphone stream;
- prefers stereo input when the browser/device can supply it;
- measures peak RMS;
- records only aggregate channel capability and signal outcome;
- does not save or transcribe audio;
- does not perform Voice Profile identification.

A mono microphone is valid. Stereo availability is a capability, not a release requirement.

## 5. Manual representative-device outcomes

Each required exercise has four states:

- **Not run** — no conclusion;
- **Pass** — the exercised behavior met the requirement;
- **Partial** — usable but degraded/incomplete;
- **Fail** — demonstrated unacceptable behavior.

Required exercises are:

- **Camera recovery:** interrupt an already-granted camera, restore it, and verify bounded recovery or a clear manual restart path. The outage must not manufacture participant departure.
- **Microphone recovery:** interrupt an already-granted microphone, restore it, and verify bounded recovery or a clear manual fallback. The outage must not become room silence.
- **Permission lifecycle:** revoke and restore camera/microphone permission. Denied/prompt-state permission must not be background-reprompted.
- **Foreground resume:** background and foreground the page. Hidden-tab suspension must not become an active runtime stall.
- **Long session:** run the representative camera/AGENT workload for at least **20 active minutes**. A selected Pass is automatically reduced to Partial if the diagnostics runtime has less than 20 measured active minutes.
- **Restart integrity:** reload/restart and verify no fabricated departure, speaker attribution, task result, current observation or revoked memory is created.
- **Storage pressure:** verify critical reported pressure pauses only optional ROOM-history persistence and does not auto-delete existing data or stop live operation.

The evidence ledger records bounded timestamped state transitions such as camera start/end, microphone result, permission changes, visibility changes, storage state and long-session checkpoints. It is not a raw sensor log.

## 6. Participant / AGENT functional acceptance

For a full representative configuration review:

1. Enroll at least two consenting participants.
2. Confirm face recognition when each participant faces the camera.
3. Confirm conservative full-body continuity through turn-away and brief occlusion.
4. Confirm participant audio meters animate only after the voice-profile/signal gate; ambient noise stays in ROOM.
5. Confirm canonical transcription and owner correction behavior.
6. Confirm unknown/conflicted/overlapping speakers do not receive participant-specific AGENT memory.
7. Confirm meetings, quiet hours, participant opt-out and interruption budgets still govern AGENT.
8. Confirm revoked/deleted participant identity and memory do not resurrect after restart.

These checks may be recorded in owner notes until dedicated automated certification fields are added by later V0.13 sections.

## 7. PASS / PARTIAL / FAIL / NOT-RUN

The 13A certification core determines one representative-device result:

- **PASS:** every required exercise passes and required camera/microphone media capability is present.
- **PARTIAL:** no required failure exists, but at least one required exercise is Partial or Not run.
- **FAIL:** a required exercise fails, the camera is unsupported, the microphone is unsupported, or `getUserMedia` is unavailable.
- **NOT-RUN:** no required exercise has meaningful evidence yet.

The result always includes `universalHardwareClaim:false`.

## 8. Export, SHA-256 and comparison

Export creates:
- `tracky2-hardware-certification-<timestamp>.json`;
- `tracky2-hardware-certification-<timestamp>.json.sha256`.

The SHA-256 is calculated locally from the canonical redacted certification payload before the integrity field is attached.

The report may contain:
- coarse runtime profile;
- owner-entered descriptive labels;
- capability matrix;
- required exercise outcomes;
- aggregate camera/microphone/runtime measurements;
- permission/storage state;
- bounded evidence events;
- certification summary;
- SHA-256 digest.

It must not contain raw images, audio, transcripts, face/voice embeddings, device IDs, group IDs or raw user-agent strings.

A previous Tracky2 hardware-certification JSON can be loaded locally for comparison. Comparison reports only certification-status, capability and exercise-outcome changes. The prior report is not uploaded or persisted by the comparison control.

## 9. Server recovery acceptance

For self-hosted PHP/SQLite installs, continue to verify separately:

1. participant synchronization remains manually enabled per participant;
2. `php server/backup.php create <directory>`;
3. `php server/backup.php verify <directory>`;
4. disposable restore creates a pre-restore recovery point;
5. browser/server participant conflicts require explicit resolution;
6. encrypted participant profile data fails closed if the original secret key is unavailable.

## 10. Certification decision

Store the exported report and SHA-256 with release evidence if desired.

A PASS result means:

> This representative Tracky2 configuration completed the stated V0.13 hardware exercises successfully.

It does **not** mean:

> Tracky2 is certified on all cameras, microphones, browsers, operating systems, acoustic environments or computers.

Physical performance remains environment-dependent. Later V0.13 sections may add more demanding multi-speaker, multi-room, recording and multi-hour device exercises; they must extend this certification contract rather than bypass it.
