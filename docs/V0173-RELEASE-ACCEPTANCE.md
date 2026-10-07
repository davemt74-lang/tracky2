# Tracky2 V0.17.3 — AGENT Onboarding Recovery Acceptance

## Scope

V0.17.3 restores the camera-first AGENT startup contract and adds two global navigation quick keys.

The live workspace remains exactly four primary tabs: Conversation, Activity, AGENT and ROOM. Meeting remains in Admin / Control Center.

## Startup contract

- A first AGENT launch enters camera onboarding automatically.
- The scene overlay is visible while browser camera permission is pending.
- Browser permission remains authoritative.
- Already-granted camera access starts immediately.
- Browser-denied camera access shows a blocked state without retry loops.
- An explicit current-version camera-auto-start OFF choice is respected.
- Successful first-run camera onboarding persists auto-start for later AGENT launches.
- Camera onboarding starts before optional meeting, memory, cognition or provider modules.
- The canonical camera path remains the only camera path.
- Camera success continues into the existing ROOM audio and identity/model scan path.

## Quick keys

Outside INPUT, TEXTAREA, SELECT and contenteditable elements:

- VVV opens Participants.
- BBB opens or reveals the AGENT Conversation view.
- ZZZ continues Camera / Orb switching.
- XXX continues sidebar visibility.
- CCC continues Control Center.

## Automated acceptance

- `npm run validate` passes.
- Camera startup policy unit tests pass.
- Early-bootstrap ordering regression passes.
- Shortcut routing and editable-target guards pass.
- CSS shell structure regression remains green.
- PHP foundation checks pass.
- Deploy ZIP contains `app-shortcuts.js`, the updated camera-preference module and this checklist.
- Deploy ZIP verification passes.

## Installed acceptance

1. Close all existing Tracky2 windows/tabs after installing V0.17.3.
2. Open Tracky2 and enter AGENT.
3. Confirm the scene/onboarding overlay starts without clicking Start camera.
4. If prompted, approve camera access and confirm video begins.
5. Confirm identity/model scanning begins and participant HUD updates.
6. Confirm room microphone starts through the existing AGENT camera path.
7. Confirm a second load auto-starts camera when permission remains granted.
8. Set camera auto-start OFF, reload, and confirm camera remains manual.
9. Turn it back ON before continuing normal use.
10. Press VVV outside a form field and confirm Participants opens.
11. Press BBB from Participants and confirm AGENT opens to Conversation.
12. Type vvv and bbb inside text inputs and confirm no navigation occurs.

Green software CI does not replace installed camera/microphone acceptance.
