# Tracky2 V0.17.0 — AGENT Refinement Acceptance

## Scope

V0.17.0 is a simplification release. It does not add a new live mode.

The primary AGENT workspace must expose exactly four tabs:

1. Conversation
2. Participant Activity
3. AGENT
4. ROOM

Meeting controls live under the administrative Control Center and are linked from the self-hosted Admin page. Meetings continue to reuse the one canonical AGENT camera, microphone, transcription, speaker-association and conversation runtime.

## Automated acceptance

- `npm run validate` passes.
- PHP foundation checks pass.
- Deploy ZIP verification passes.
- No legacy gameplay module or UI returns.
- No `roomMeetingTab`, `roomMeetingPanel`, `requestedMeeting` or `requestedMode==='meeting'` routing remains.
- Meeting core and meeting metadata tests remain green.
- V0.17.0 packaging/version/cache identifiers agree.

## Installed acceptance

1. Splash opens AGENT automatically.
2. Only Conversation, Participant Activity, AGENT and ROOM appear as the primary tabs.
3. Camera starts and remains stable.
4. The live participant microphone meter moves with speech.
5. A spoken turn is transcribed, accepted, answered and spoken by TTS.
6. Listening resumes and a second turn works without reload.
7. Participant identity/voice matching still enriches turns without gating the live meter.
8. ROOM continues to separate ambient/environment audio from participant speech.
9. Open Admin, choose Meetings, and confirm meeting controls open in the administrative Control Center.
10. Start/end a meeting and verify the same AGENT camera/microphone session is reused and canonical turns receive meeting metadata.

Green software CI does not substitute for installed camera/microphone testing.
