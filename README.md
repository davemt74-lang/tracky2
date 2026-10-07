# Tracky2 V0.17.4 — Flat Deploy Repair

Tracky2 is a local-first **AGENT** experience. V0.17.4 fixes the deploy artifact so an upload-and-extract install lands directly in the web document root.

## Primary AGENT workspace

The live AGENT page has exactly four primary tabs. The visible labels are kept compact so the tab bar stays inside the left sidebar:

- **Conversation** — chronological participant speech and AGENT responses.
- **Activity** — verified participant presence and camera-relative activity (accessible name: Participant Activity).
- **AGENT** — voice, provider, memory, task and cognitive controls.
- **ROOM** — the unified environment/hearing/background-action evidence feed.

Camera and Orb remain presentation choices for the same live sensor session. They are not separate modes.

## Meetings moved to Admin

Meeting is no longer a primary AGENT tab and there is no Meeting URL mode.

Meeting controls now live in the administrative Control Center and are linked from `server/admin.php`. Opening those controls does **not** create a second camera, microphone, transcription or conversation engine. Meetings continue to reuse the single AGENT runtime and stamp canonical turns with meeting metadata while a meeting is active.

Every `vertical-motion.html` entry initializes the same AGENT presentation. Legacy mode query strings no longer decide whether the shell loads.

## Camera-first onboarding

Entering AGENT starts the canonical camera onboarding path immediately unless the owner has explicitly disabled camera auto-start in the current preference version. On first launch, the scene overlay becomes visible and the browser may ask for camera permission. Once camera access succeeds, Tracky2 enables future AGENT camera auto-start and continues through the existing identity/model scan. Browser-denied permission remains blocked until the owner changes it in browser settings.

Camera onboarding begins before optional meeting, memory, cognition and provider modules initialize, so those features cannot silently prevent the scan from starting.

## Quick keys

Outside text fields and editable controls:

- `VVV` opens **Participants**.
- `BBB` opens or reveals the **AGENT Conversation** view.
- Existing `ZZZ`, `XXX` and `CCC` shortcuts remain unchanged.

## Conversation runtime

The primary live path remains:

**microphone → live input meter → speech segment → local transcription → AGENT turn → reply → TTS → listening resumes**

Voice-profile identity, camera/body association, diarization, ROOM media-origin analysis and contextual cognition enrich accepted turns but do not decide whether a valid transcribed AGENT turn is heard.

The participant Voice Input meter is driven directly by the active room microphone. Voice-profile enrollment is not required for the meter to move.

## Providers and speech

Conversational AI is opt-in. AGENT can use configured OpenAI or Anthropic server-side credentials, or loopback Ollama. Browser/system speech and optional ElevenLabs are supported for TTS. Stored provider credentials are never returned to the browser.

## Self-hosting

The release ZIP is a **flat document-root deploy**. Upload the ZIP into the domain/subdomain document root and extract it there. After extraction, `index.html`, `vertical-motion.html`, `server/`, `src/`, and `assets/` must be directly in that folder—there is no version wrapper directory.

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

Installed acceptance for V0.17.4 starts with the document-root deployment shape, then the recovered camera-first path:

**splash → AGENT → four tabs only → camera works → live mic meter moves → transcript appears → AGENT replies → TTS speaks → listening resumes**

Then open **Admin → Meetings** and verify meeting controls reuse the same running AGENT session.

## Release policy

A release is complete only after required tests, release audit, PHP foundation checks and deploy ZIP verification pass on the merged commit. Installed camera/microphone behavior remains a separate device acceptance gate.
