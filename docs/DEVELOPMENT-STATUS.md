# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V010-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. No VP3 Cloud or HomeServer integration.

## Completed and verified
- **Phase 0** — PR #32, merged `b706945c09c1b30798857b05cd46f5545e9d6db9`.
- **10A** — PR #33. Canonical ROOM ledger. V0.10.0. **10/10**.
- **10B** — PR #34. Owner-defined camera-relative scene graph. V0.10.1. **10/10**.
- **10C** — PR #35. Conservative movement/temporal awareness. V0.10.2. **10/10**.
- **10D** — PR #36. Consented acoustic metadata/canonical transcript corrections. V0.10.3. **10/10**.
- **10E** — PR #37. Governed cognitive greeting/abstention loop. V0.10.4. **10/10**.
- **10F** — PR #38. Allowlisted local tasks with explicit confirmation/cancel/retry/idempotency. V0.10.5. **10/10**.
- **10G** — PR #39. Controlled owner-authored participant/session memory. V0.10.6. **10/10**.
- **10H** — PR #40, merged `fae75d5df87eeca6b41c2432abf5943dde1b030d`. Encrypted standalone participant sync/recovery. V0.10.7 SHA-256 `f82746eb9fbe019fae5b6b54fabf30fd6fff1203817f5471248d220a57adab21`. **10/10**.
- **10I** — PR #41, merged `836e69118603cbbfd30cac5f6270ad5524babfb8`. Coherent responsive AGENT/ROOM UI. V0.10.8 SHA-256 `0201dc26c0202cb156ae307a636001f057befb1b9b79f3f122a9593867c3c6e5`. **10/10**.

Automated gates are not physical device certification. Camera-relative geometry is not calibrated physical location; shared microphone input is not live per-person source separation; acoustic patterns do not identify sound sources or diagnose health.

## Active section: 10J — resilience and final V0.10 release hardening
- **Branch:** `feat/v010j-resilience-release`, based on verified 10I main.
- **Audit baseline:** **7.8/10** before work.
- **Runtime budgets:** aggregate foreground frame-gap/stall counters, room-scan latency, and maximum audio queue depth. Hidden-tab suspension is excluded.
- **Sensor recovery:** camera/microphone recovery uses separate 3-attempt / 2-minute budgets. Automatic retry requires already-granted permission, visible page and no manual stop; permission is rechecked before access.
- **Permission lifecycle:** camera/microphone permission changes are surfaced in ROOM. Denied/prompt state is never background-reprompted.
- **Storage pressure:** healthy <75%, warning 75–<90%, critical >=90% of browser-reported quota. Critical pressure pauses optional ROOM-history writes only; live operation and existing data remain intact.
- **Diagnostics:** V0.10 representative-device report now includes aggregate runtime, permission/storage state and explicit camera/mic outage, permission, foreground, >=20-minute session, restart and storage-pressure checks.
- **Physical boundary:** `docs/V010-RELEASE-ACCEPTANCE.md` and `docs/hardware-acceptance.md` distinguish software-green delivery from representative-device evidence and universal certification.
- **Tests:** deterministic recovery/storage/runtime/permission/acceptance fixtures plus integration assertions that canonical capture/persistence pipelines remain in use.
- **Release target:** V0.10.9.
- **Gate remaining:** PR Node/PHP checks → fix demonstrated failures → merge → post-merge checks → direct V0.10.9 ZIP + SHA-256. Only then score software delivery **10/10**. Physical-device acceptance remains separately recorded per tested hardware.

## Exact next action
Open the 10J PR, repair only demonstrated failures, merge after both required checks pass, verify V0.10.9 release assets/checksum, then close the standalone V0.10 software build.
