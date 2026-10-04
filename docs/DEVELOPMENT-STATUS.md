# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V010-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. No VP3 Cloud or HomeServer integration.

## Completed and verified
- **Phase 0** — PR #32, merged `b706945c09c1b30798857b05cd46f5545e9d6db9`. Baseline audit/master plan/release guard.
- **10A** — PR #33, merged `08fc61ea25892a941eee4bf49ebd8281f36e302a`. Canonical ROOM ledger. V0.10.0 SHA-256 `b9ea8253396ea890b9fb4c1c9d9c95cd0a153758075069d983ec5d823ed0010e`. **10/10**.
- **10B** — PR #34, merged `fa36c9894faa41bd8559a3ea61e4082a714aa1a8`. Owner-defined camera-relative scene graph. V0.10.1 SHA-256 `252ab608ff13835cd4b22ab99a19cd3049aee85773ec192c4bdbdba994532050`. **10/10**.
- **10C** — PR #35, merged `ebbcb71d71253aedf8981cc5124b8f7e60d4ca84`. Conservative movement/temporal awareness. V0.10.2 SHA-256 `375d6b90e281b6151581411a0ca659e1644ba507e1851c7812e636a883038441`. **10/10**.
- **10D** — PR #36, merged `ed09c180576a7a2820b72d6d064fa08ce5898ff8`. Consented acoustic metadata/canonical transcript corrections. V0.10.3 SHA-256 `aac31ad113b01471d5e512976069bd9282c29a9be7a8cd387979a16fe562991f`. **10/10**.
- **10E** — PR #37, merged `3f6c6e9512d53f353225c8b783ce974e19da15aa`. Governed cognitive greeting/abstention loop. V0.10.4 SHA-256 `8002972fc4e9c3b4047d74db19513c6a5790451141e34e70f5fbdf8db9173202`. **10/10**.
- **10F** — PR #38, merged `a876c6f4ee08645b49b3f87b2df1609dbb6c1331`. Allowlisted local tasks and explicit confirmation/scheduling/cancel/retry/idempotency. V0.10.5 SHA-256 `3c1b3e8d4a90fedd5d3781950f5f3cd0551f5c5eff85c75a1a3d7ece70c5143f`. **10/10**.
- **10G** — PR #39, merged `a3988c49c67eb5f4bea903bedc33c3f3bfd37bff`. Controlled owner-authored participant/session memory with expiry, revision, revocation and verified retrieval. Required/post-merge CI passed. V0.10.6 SHA-256 `06a29f1be04e01f668fd23fc8dd7c45886a131ade06fda4a2d6761ae8ab3b79c`. **10/10**.

Automated gates are not physical device certification. Camera-relative geometry is not calibrated physical location; acoustic patterns do not identify sound sources or diagnose health.

## Active section: 10H — standalone PHP/SQLite synchronization and recovery
- **Branch:** `feat/v010h-standalone-sync`, based on verified 10G main.
- **Server migration:** schema version 2 is additive and runtime-gated. Existing plaintext participant `profile_json` is transactionally encrypted into `profile_ciphertext` with the instance secret key; missing key fails closed.
- **Sync scope:** participants only. Transcripts, ROOM events, memories, tasks, game history and scene data are explicitly excluded from this sync path.
- **Browser state:** IndexedDB v7 stores reconciliation metadata only: enablement, acknowledged server version, last-synced local revision, deletion tombstone and consent-confirmation time.
- **Conflict model:** optimistic server versions + tombstones. Initial two-copy and two-sided edits never auto-merge. Owner chooses **Keep browser** or **Keep server**; an unseen newer server version re-opens conflict.
- **Consent/privacy:** synchronization is manual and per participant. Biometric profiles require explicit participant consent. Server profile payloads are encrypted at rest.
- **Recovery:** CLI-only `server/backup.php` creates DB + secret.key + installed.lock + SHA-256 manifest, verifies SQLite/decryption, and restores only with `--yes` after creating a pre-restore recovery point.
- **Permissions:** new `sync.manage` grant defaults to owner/admin and gates the dedicated sync API/UI.
- **Tests:** deterministic reconciliation JS tests, PHP fresh-schema security checks, legacy-schema migration/idempotency fixture, authenticated sync/conflict smoke, encrypted-at-rest assertion, backup verify/restore.
- **Release target:** V0.10.7.
- **Gate remaining:** PR Node/PHP checks → merge → post-merge checks → direct V0.10.7 ZIP + SHA-256 verification. Only then mark 10H **10/10** and continue to 10I.

## Exact next action
Open the 10H PR, repair only demonstrated failures, merge after Node/package and PHP fresh/upgrade/security checks pass, verify the V0.10.7 release ZIP/checksum, then begin **10I — final standalone V0.10 security/privacy/release hardening and physical acceptance matrix**.
