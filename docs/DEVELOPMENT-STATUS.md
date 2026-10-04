# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V010-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. No VP3 Cloud or HomeServer integration.

## Completed and verified
- **Phase 0** — PR #32, merged `b706945c09c1b30798857b05cd46f5545e9d6db9`. Baseline audit/master plan/release guard.
- **10A** — PR #33, merged `08fc61ea25892a941eee4bf49ebd8281f36e302a`. Canonical ROOM ledger. V0.10.0 SHA-256 `b9ea8253396ea890b9fb4c1c9d9c95cd0a153758075069d983ec5d823ed0010e`. **10/10**.
- **10B** — PR #34, merged `fa36c9894faa41bd8559a3ea61e4082a714aa1a8`. Owner-defined camera-relative scene graph. V0.10.1 SHA-256 `252ab608ff13835cd4b22ab99a19cd3049aee85773ec192c4bdbdba994532050`. **10/10**.
- **10C** — PR #35, merged `ebbcb71d71253aedf8981cc5124b8f7e60d4ca84`. Conservative movement/temporal awareness. V0.10.2 SHA-256 `375d6b90e281b6151581411a0ca659e1644ba507e1851c7812e636a883038441`. **10/10**.
- **10D** — PR #36, merged `ed09c180576a7a2820b72d6d064fa08ce5898ff8`. Consented acoustic metadata/canonical transcript corrections. V0.10.3 SHA-256 `aac31ad113b01471d5e512976069bd9282c29a9be7a8cd387979a16fe562991f`. **10/10**.
- **10E** — PR #37, merged `3f6c6e9512d53f353225c8b783ce974e19da15aa`. Governed cognitive greeting/abstention loop. V0.10.4 SHA-256 `8002972fc4e9c3b4047d74db19513c6a5790451141e34e70f5fbdf8db9173202`. **10/10**.
- **10F** — PR #38, merged `a876c6f4ee08645b49b3f87b2df1609dbb6c1331`. Allowlisted local tasks, explicit confirmation, scheduling/cancel/retry/idempotency and read-only describe-object execution. Required/post-merge CI passed. V0.10.5 SHA-256 `3c1b3e8d4a90fedd5d3781950f5f3cd0551f5c5eff85c75a1a3d7ece70c5143f`. **10/10**.

Automated gates are not physical device certification. Camera-relative geometry is not calibrated physical location; acoustic patterns do not identify sound sources or diagnose health.

## Active section: 10G — controlled participant/session memory
- **Branch:** `feat/v010g-controlled-memory`, based on verified 10F main.
- **Durable-memory boundary:** only explicit owner-authored `preference`, `relationship`, or `note` rows can be persisted. Relationship text is an owner statement, never inferred.
- **Session vs durable:** session-only rows remain in memory; durable rows save only when the owner explicitly checks the device-save control.
- **Canonical context:** current transcript turns and ROOM events are read from their existing stores during retrieval and labelled current-session. They are not copied automatically into durable memory.
- **Provenance/lifecycle:** owner authority/provenance, participant or room scope, optional expiry, bounded revision history, revocation reason/state and permanent deletion.
- **Identity gate:** participant-specific memory is supplied to conversational AGENT only when the dialogue turn has verified participant attribution. Unknown speech receives no participant memory.
- **Deletion:** IndexedDB v6 memory store is included in the same participant deletion transaction as profile/dialogue/ROOM attribution.
- **UI:** AGENT memory panel supports scope/type/text/expiry, session vs local persistence, edit/revoke/delete, revoked-memory inspection and current canonical context.
- **Tests:** scope/expiry/revision/revocation/deletion, canonical-reference nonduplication, verified conversational retrieval, provider temporal wording, persistence privacy and UI integration.
- **Release target:** V0.10.6.
- **Gate remaining:** PR Node/PHP checks → merge → post-merge checks → verify direct V0.10.6 ZIP + SHA-256. Only then mark 10G **10/10** and begin 10H.

## Exact next action
Open the 10G PR, repair only demonstrated failures, merge after both required checks pass, verify V0.10.6 release assets/checksum, then begin **10H — standalone PHP/SQLite synchronization, migration and conflict handling** from current main.
