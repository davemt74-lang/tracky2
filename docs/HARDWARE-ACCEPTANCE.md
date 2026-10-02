# Tracky2 V0.4E — Physical device acceptance

Automated tests cover deterministic inputs; they cannot certify physical cameras, microphones or identity/voice recognition. Every target OS/browser/device combination needs supervised, consent-based hands-on testing.

## Environment
- Record browser and OS versions, webcam model/resolution and microphone model (without attaching private information).
- Open the site on localhost or HTTPS. With explicit consent, enroll two different participants and optionally enroll their voice profiles.
- Select multiplayer mode, assign green and blue controller markers, and start camera. Ensure the display presents **one shared four-section board**.

## Camera test
- Tune Normal, Low Light and Bright calibration separately in realistic lighting.
- Start **Live camera diagnostics** and hold both colored markers in view; move each across all four sections, briefly obscure each, and observe recovery without extra repetitions.
- Verify only the active color changes score. Complete a green round and observe the same board turn blue, then complete blue's round and observe the board turn green.
- Verify frame cadence remains acceptable on that particular physical device and both markers are reliably detected. Test deliberate fast motions and interference with similarly colored backgrounds.
- Record a minimum of 60 frames, stop and export the aggregate JSON. A numeric measurement alone is not a certification pass.

## Participant/voice test
- With consent, confirm enrolled face/body presence on entry, brief occlusion and turning away; ambiguous matches must not silently change manual marker ownership.
- Optionally enable room audio and check microphone permission, voice model readiness, enrolled speaker recognition and ambiguous/noisy speech rejection. Check the UI when microphone permission is denied.
- Stop camera and microphone; confirm inputs cease, tracks are released and local opt-in match-history controls work correctly.

## Signoff
For each device and lighting condition, document pass/fail, repeat count, measured frame cadence and blockers. Do not attach personal recordings or raw biometric information to any issue. Only a completed supervised run can establish hardware readiness; the exported aggregate report always states `hardwareCertified: false`.
