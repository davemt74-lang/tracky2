# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V010-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. No VP3 Cloud or HomeServer integration.

## Completed and verified
- **Phase 0** — PR #32, merged `b706945c09c1b30798857b05cd46f5545e9d6db9`. Baseline audit/master plan/release guard.
- **10A** — PR #33, merged `08fc61ea25892a941eee4bf49ebd8281f36e302a`. Canonical ROOM ledger. V0.10.0 deploy SHA-256 `b9ea8253396ea890b9fb4c1c9d9c95cd0a153758075069d983ec5d823ed0010e`. Delivery **10/10**.
- **10B** — PR #34, merged `fa36c9894faa41bd8559a3ea61e4082a714aa1a8`. Owner-defined camera-relative scene graph. V0.10.1 deploy SHA-256 `252ab608ff13835cd4b22ab99a19cd3049aee85773ec192c4bdbdba994532050`. Delivery **10/10**.
- **10C** — PR #35, merged `ebbcb71d71253aedf8981cc5124b8f7e60d4ca84`. Conservative movement/temporal awareness. V0.10.2 deploy SHA-256 `375d6b90e281b6151581411a0ca659e1644ba507e1851c7812e636a883038441`. Delivery **10/10**.
- **10D** — PR #36, merged `ed09c180576a7a2820b72d6d064fa08ce5898ff8`. Consented acoustic metadata and canonical transcript correction. V0.10.3 deploy SHA-256 `aac31ad113b01471d5e512976069bd9282c29a9be7a8cd387979a16fe562991f`. Delivery **10/10**.
- **10E** — PR #37, merged `3f6c6e9512d53f353225c8b783ce974e19da15aa`. Governed cognitive greeting loop with explicit abstention, quiet hours, opt-outs, cooldown and decision/outcome provenance. Required and post-merge CI passed. V0.10.4 deploy SHA-256 `8002972fc4e9c3b4047d74db19513c6a5790451141e34e70f5fbdf8db9173202`. Delivery **10/10**.

Automated delivery gates are not physical device certification. Camera-relative geometry is not calibrated physical location; acoustic patterns do not identify sound sources or diagnose health.

## Active section: 10F — approved local skills/tasks
- **Branch:** `feat/v010f-approved-skill-task-execution`, based on verified 10E main.
- **Registry reuse:** exact existing standalone skill IDs remain `describe_object`, `capture_image`, and `product_search`. No second arbitrary plugin/command registry.
- **Executable now:** only `describe_object`, a read-only result from owner-entered scene metadata. `capture_image` and `product_search` remain visible as unavailable until separately approved executors exist.
- **Task contract:** pending confirmation → scheduled → running → succeeded/failed/cancelled. Owner confirmation is mandatory before execution. Scheduling executes only while the AGENT page is open.
- **Reliability:** active-task idempotency, bounded retry state, interrupted-running recovery to scheduled, cancellation before execution, bounded local IndexedDB v5 task metadata, terminal-record cleanup.
- **Audit:** proposed/confirmed/cancelled/action/outcome records use the existing canonical ROOM ledger. No media, credentials, embeddings or arbitrary command payloads are stored in task metadata.
- **UI:** AGENT task panel selects owner-defined objects, schedules, confirms, runs/cancels and displays results/errors.
- **Tests:** allowlist compatibility, unavailable executor rejection, confirmation, dedupe, scheduling, cancellation, retry, restore, persistence privacy and integration fixtures are on branch.
- **Release target:** V0.10.5.
- **Gate remaining:** PR Node/PHP checks → merge → post-merge checks → verify direct V0.10.5 ZIP + SHA-256. Only then mark 10F **10/10** and begin 10G.

## Exact next action
Open the 10F PR, fix only demonstrated failures, merge after both required checks pass, verify V0.10.5 release assets/checksum, then begin **10G — controlled participant and session memory** from current main.
