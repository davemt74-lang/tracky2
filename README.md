# Tracky2 V0.17.0 — AGENT Refinement

Tracky2 is a local-first **AGENT** experience. V0.17.0 begins the simplification pass after the legacy gameplay removal.

## Primary AGENT workspace

The live AGENT page has exactly four primary tabs:

- **Conversation** — chronological participant speech and AGENT responses.
- **Participant Activity** — verified participant presence and camera-relative activity.
- **AGENT** — voice, provider, memory, task and cognitive controls.
- **ROOM** — the unified environment/hearing/background-action evidence feed.

Camera and Orb remain presentation choices for the same live sensor session. They are not separate modes.

## Meetings moved to Admin

Meeting is no longer a primary AGENT tab and there is no Meeting URL mode.

Meeting controls now live in the administrative Control Center and are linked from `server/admin.php`. Opening those controls does **not** create a second camera, microphone, transcription or conversation engine. Meetings continue to reuse the single AGENT runtime and stamp canonical turns with meeting metadata while a meeting is active.

Legacy `?mode=meeting` URLs simply open the normal AGENT runtime; they do not switch the product into another mode.

## Conversation runtime

The primary live path remains:

**microphone → live input meter → speech segment → local transcription → AGENT turn → reply → TTS → listening resumes**

Voice-profile identity, camera/body association, diarization, ROOM media-origin analysis and contextual cognition enrich accepted turns but do not decide whether a valid transcribed AGENT turn is heard.

The participant Voice Input meter is driven directly by the active room microphone. Voice-profile enrollment is not required for the meter to move.

## Providers and speech

Conversational AI is opt-in. AGENT can use configured OpenAI or Anthropic server-side credentials, or loopback Ollama. Browser/system speech and optional ElevenLabs are supported for TTS. Stored provider credentials are never returned to the browser.

## Self-hosting

Install through `server/install.php`. The first owner account is created by the installer.

Run locally:

```bash
npm run serve
```

Then open `http://localhost:8080/`.

## Validation

Run:

```bash
npm run validate
```

Installed acceptance for V0.17.0 focuses on the simplified path:

**splash → AGENT → four tabs only → camera works → live mic meter moves → transcript appears → AGENT replies → TTS speaks → listening resumes**

Then open **Admin → Meetings** and verify meeting controls reuse the same running AGENT session.

## Release policy

A release is complete only after required tests, release audit, PHP foundation checks and deploy ZIP verification pass on the merged commit. Installed camera/microphone behavior remains a separate device acceptance gate.
