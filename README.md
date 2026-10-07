# Tracky2 V0.16.0 — AGENT-Only Runtime

Tracky2 is now a local-first **AGENT** experience. The legacy gameplay platform has been retired. After the splash screen, Tracky2 opens the immersive AGENT page directly.

## Current product surface

AGENT combines the existing camera, participant identity, room audio, voice profiles, transcription, conversation, ROOM intelligence and governed agent systems in one runtime.

The primary page is `vertical-motion.html?mode=agent`. The splash at `index.html` links and auto-enters that page. The old `games.html` URL remains only as a compatibility redirect to AGENT.

### Main AGENT views

- **Camera / Orb** — switch between live camera visualization and the floating AGENT orb without changing the underlying camera/audio session.
- **Conversation** — chronological participant/user speech plus AGENT responses.
- **Participant Activity** — confirmed participant presence and camera-relative activity.
- **AGENT** — speech output, model/provider, history, memory, tasks and cognitive controls.
- **Meeting** — standalone meeting workflow using the same AGENT camera/audio/transcript runtime.
- **ROOM** — unified room-level environment, hearing, background actions and evidence feed.
- **Control Center** — account, ROOM settings, diagnostics and advanced room mapping.

## Retired gameplay

V0.16.0 removes the former gameplay product and runtime:

- Random Follow Pattern
- Reaction Challenge
- Classic solo scoring
- Classic multiplayer scoring
- game lobby and player-game setup
- point goals, rounds, score/repetition HUDs
- shared gameboard and movement lane
- match history and gameplay sessions
- game platform/registry infrastructure used by those retired modes

`src/games/agent.js` remains as a small compatibility description of AGENT. It does not create a board, scoring session or independent camera/microphone stack.

Hardware Diagnostics now measures generic camera performance, microphone transport and runtime resilience only; marker/color gameplay probes are removed.

## Conversation runtime

Normal AGENT conversation follows the direct path:

**microphone → live input meter → speech segment → local transcription → AGENT turn → reply → TTS → listening resumes**

Voice-profile identity, camera/body association, diarization, ROOM media-origin analysis and contextual cognition enrich the turn after the primary conversation path. They do not determine whether a valid transcribed AGENT turn is heard.

The participant Voice Input meter is driven directly by the active room microphone. Voice-profile enrollment is not required for the meter to move.

## Providers and speech

Conversational AI is explicitly opt-in. When enabled, AGENT can use the configured OpenAI or Anthropic self-hosted provider route, or loopback Ollama. Without a configured/enabled model, the local scripted conversation fallback remains available.

Speech output supports browser/system speech and optional self-hosted ElevenLabs. Remote voice generation is cancellable, and the microphone is suppressed only while response audio is actually playing.

## Participants and privacy

Participant profiles can include local face samples and optional Voice Profiles. Identity confidence is conservative: visual proximity alone does not establish speaker identity. Raw enrollment audio is converted into speaker embeddings and discarded.

ROOM environmental intelligence remains separate from participant Conversation. Music, TV/video/radio/podcast and other room-level detections do not become participant speech merely because a person is visible.

## Self-hosting

The self-hosted installer remains under `server/install.php`. The first owner account is created through the installer. Provider credentials are stored server-side and are not returned to the browser.

Run locally:

```bash
npm run serve
```

Then open:

```text
http://localhost:8080/
```

The splash opens AGENT. Direct entry is:

```text
http://localhost:8080/vertical-motion.html?mode=agent
```

## Validation

Run:

```bash
npm run validate
```

CI validates the remaining codebase, release audit, PWA shell and deploy ZIP. Green software validation does not certify a particular camera, microphone, browser or installed device.

Installed-runtime acceptance for the conversation loop is:

**speak → meter moves → transcript appears → AGENT replies → response is spoken → listening resumes → repeat without reload**

## Release policy

No release is considered complete until required tests, release audit, PHP foundation checks and deploy ZIP verification pass on the merged commit. Installed-device behavior remains a separate acceptance gate.
