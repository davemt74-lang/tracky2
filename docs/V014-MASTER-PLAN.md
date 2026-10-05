# Tracky2 V0.14 — Governed Agent Capability & Self-Hosted Intelligence

Baseline: V0.13.9, current merged `main` `a54a73c15a5846c318f02d808b3ed7807637e962`.

**Tracky2 remains standalone for V0.14.** V0.14 must not introduce VP3 Cloud, HomeServer, Agent Eyes, or another product dependency. V0.13 Sections 13A–13J are closed and must not be restarted.

## Why V0.14

V0.13 completed the real-world sensing/reliability layer: representative-device certification, overlap handling, participant continuity, multi-room runtime, saved recordings, environmental/routine intelligence, proactive behavior, long-run device hardening, and release certification.

The next limiting factor is no longer perception. It is **turning the existing bounded agent framework into a useful governed execution system** while preserving Tracky2's local-first, owner-controlled, privacy-safe architecture.

The audit found several frameworks that are intentionally ahead of their executable runtime:

- encrypted OpenAI, Anthropic, and ElevenLabs credentials exist on the self-hosted server, but live provider routing is not enabled;
- the task queue and approval model exist, but only `describe_object` currently has a real registered executor;
- approved scene objects can carry allowlisted skills, but capture/search/governed execution is not end-to-end;
- participant server sync is encrypted and conflict-safe, but remains manual and participant-only;
- multi-room federation is functional through a bounded polling relay but is not yet low-latency/event-driven;
- local recall is canonical and explainable, but currently uses bounded literal-token matching rather than richer semantic retrieval;
- recording and session systems are strong locally, but archive/export/import portability is still limited;
- self-hosted backup/recovery exists, but operational health, provider budgets, job visibility, and admin diagnostics remain shallow.

V0.14 closes those gaps without creating new identity, microphone, transcript, memory, or surveillance authorities.

## V0.14 invariants

1. **V0.13 stays closed.** V0.14 may extend merged V0.13 modules but does not reopen or re-score 13A–13J.
2. **Tracky2 stays standalone.** No VP3 Cloud/HomeServer dependency is introduced.
3. **Canonical perception remains authoritative.** Agent/provider/tool logic cannot override participant identity, speaker attribution, transcript correction, room handoff/conflict, deletion/revocation, or meeting policy.
4. **One live ROOM microphone and one canonical transcript authority remain unchanged.**
5. **External providers are optional.** Local Ollama and deterministic local fallbacks remain valid; provider failure must degrade safely.
6. **Provider secrets remain server-side.** Browser clients never receive stored OpenAI/Anthropic/ElevenLabs API keys.
7. **Tool execution is allowlisted and owner-governed.** No arbitrary shell, URL, filesystem, or code execution.
8. **Side effects require explicit policy.** Tasks distinguish read-only, local-write, media-capture, external-network, and destructive actions with appropriate confirmation.
9. **No silent permanent memory.** Durable participant/owner memory requires an explicit owner-approved path and supports edit, revoke, expiry, and deletion propagation.
10. **No hidden synchronization.** Any broader browser/server sync is explicit, scoped, encrypted where sensitive, conflict-aware, and independently revocable.
11. **No hidden recording or media export.** Existing visible consent/retention controls remain authoritative.
12. **Unknown/conflict/abstain remain valid outputs.** Provider or tool reasoning cannot manufacture certainty.
13. **Budgets are bounded.** Provider spend/tokens, task retries, network calls, queues, caches, sync journals, semantic indexes, archive size, and audit logs all receive explicit limits.
14. Every section follows **audit → scored baseline → acceptance contract → implementation → deterministic tests → PR → green CI → merge → post-merge verification → package/checksum**.

## Audited V0.13.9 baseline

Current `main` already provides:

- local Ollama conversational routing with identity-safe prompting;
- encrypted OpenAI, Anthropic, and ElevenLabs credential storage in self-hosted Admin;
- an agent task queue with confirmation, idempotency, retries, cancellation, persistence bounds, and task audit metadata;
- approved scene objects and per-object allowlisted skill metadata;
- explicit/manual encrypted participant synchronization with optimistic conflicts;
- same-origin multi-room node registry, heartbeat, primary arbitration, clock-skew normalization, deduplication, and bounded remote observations;
- local saved recording capture, retention, corruption detection, playback, deletion, and transcript references;
- canonical recall projection over dialogue, ROOM, meetings, recordings, tasks, and owner memory;
- bounded proactive intelligence, routine intelligence, meeting context, participant continuity, overlap separation, and long-session performance governance;
- CLI backup/verify/restore with database/key integrity checks;
- PWA packaging, deterministic Node tests, PHP security/foundation tests, ZIP generation, SHA-256, and direct releases.

## Section sequence and scored baselines

### 14A — Provider Runtime & Model Router
**Baseline: 5.8/10**

Existing:
- encrypted OpenAI/Anthropic/ElevenLabs credentials;
- secure provider status UI;
- local Ollama client and bounded identity-safe prompt construction.

Missing:
- no live server-mediated OpenAI/Anthropic routing;
- no common provider contract/model selection;
- no token/request budget enforcement;
- no timeout/retry/circuit-breaker policy;
- no privacy-safe request audit;
- ElevenLabs is stored but not integrated into optional AGENT speech.

**Target:** one governed model router supporting local Ollama plus optional server-mediated OpenAI/Anthropic and optional ElevenLabs TTS, with browser-safe provider status, bounded budgets, cancellation, provider health, and deterministic fallback.

**Gate:** secrets never reach browser; disabled/unconfigured providers fail closed; per-request timeout; bounded retries; token/character caps; daily/session budget policy; cancellation; model allowlist; provider fallback; identity-safe prompt parity; no raw biometric/media upload; audited provider metadata only.

### 14B — Governed Skills & Tool Execution
**Baseline: 4.9/10**

Existing:
- approved scene objects;
- allowlisted skill metadata;
- `describe_object` executor;
- unavailable placeholders for `capture_image` and `product_search`.

Missing:
- no complete execution registry;
- no capability classes/side-effect policy;
- no skill-specific consent/reconfirmation;
- no immutable execution provenance;
- no safe network/search adapter.

**Target:** an explicit skill registry and policy engine with governed read-only/local-write/media/network classes. Implement only narrowly scoped skills with deterministic contracts.

**Gate:** object approval required; skill must be enabled for the object/scope; no arbitrary commands/URLs; capture requires visible camera state and explicit owner action; external search is query-only with bounded result metadata; every execution records skill/version/scope/result state without sensitive payload leakage; cancellation and revocation are authoritative.

### 14C — Agent Tasks & Workflow Execution V2
**Baseline: 6.1/10**

Existing:
- persistent bounded queue;
- scheduled state;
- confirmation;
- idempotency;
- retry/cancel/result handling.

Missing:
- only one executable skill;
- no dependency graph;
- no multi-step governed workflow;
- limited resume/recovery semantics;
- no task-level policy snapshot.

**Target:** make tasks useful by composing approved skills into bounded workflows while preserving confirmation and cancellation boundaries.

**Gate:** task dependencies; max step count; policy snapshot; restart recovery; stale authorization invalidation; per-step idempotency; retry classification; visible progress; cancellation between steps; participant/object deletion invalidates dependent tasks; no background privilege escalation.

### 14D — Owner-Approved Memory Learning V2
**Baseline: 6.4/10**

Existing:
- owner-authored durable memory;
- participant scoping;
- revisions/revocation/expiry;
- canonical session context references.

Missing:
- no governed promotion from conversation/ROOM/meeting evidence into proposed memory;
- no duplicate/contradiction review;
- no provenance-rich approval queue.

**Target:** AGENT may propose concise memories from canonical evidence, but only owner approval creates durable memory.

**Gate:** proposal is non-durable until approved; source references required; unknown/conflicted speakers cannot create participant-scoped proposals; contradiction/duplicate detection; edit-before-save; expiry choice; revoke/delete propagation; no sensitive inference; no automatic health/emotion/protected-trait memory.

### 14E — Recall & Search Intelligence V2
**Baseline: 7.1/10**

Existing:
- canonical projection over dialogue/ROOM/meetings/recordings/tasks/memory;
- participant/source/time filters;
- explainable provenance and stale references;
- no persistent search index.

Missing:
- literal-token matching only;
- weak ranking across paraphrases;
- no bounded semantic index;
- limited summarization of large result sets.

**Target:** optional local semantic recall over canonical records with exact provenance and deterministic lexical fallback.

**Gate:** local index only by default; bounded index size; participant deletion/revocation removes indexed references; semantic result always links to canonical source; stale sources remain visibly stale; no raw recording media indexed; lexical fallback when embeddings unavailable; result explanations include why/source/time.

### 14F — Encrypted Server Sync V2
**Baseline: 5.6/10**

Existing:
- explicit encrypted participant sync;
- per-participant consent;
- optimistic version conflicts;
- deletion tombstones.

Missing:
- sync is manual and participant-only;
- no scoped sync for approved memories/tasks/scene configuration;
- no resumable sync journal;
- no selective device scopes.

**Target:** add optional owner-enabled synchronization for a narrowly allowlisted set of metadata objects, never automatic blanket database mirroring.

**Gate:** resource-by-resource enablement; encryption for sensitive payloads; versioned conflict handling; tombstones; resumable journal; quota; device/session revocation; participant biometric consent remains separate; transcripts/recording media stay excluded unless a later explicit section adds them.

### 14G — Multi-Room Federation V3
**Baseline: 7.3/10**

Existing:
- same-origin relay;
- heartbeat/staleness;
- primary arbitration;
- dedupe;
- skew normalization;
- explicit handoff/no-teleport rules.

Missing:
- polling interval introduces latency;
- weak operational visibility;
- no connection epoch/replay cursor persistence;
- no event-stream transport.

**Target:** low-latency same-origin federation with safe fallback to existing polling.

**Gate:** EventSource/WebSocket only if same-origin/authenticated and permission-checked; polling fallback; connection epochs; replay cursor; duplicate suppression; stale-node cleanup; reconnect; clock skew; no camera/audio/transcript transport; no route inference; primary arbitration unchanged.

### 14H — Recording & Session Archive Portability
**Baseline: 7.0/10**

Existing:
- local chunked recording;
- retention;
- playback validation;
- transcript references;
- metadata export;
- session timeline.

Missing:
- no portable owner-requested archive/import format;
- no archive integrity manifest;
- no cross-device restore workflow.

**Target:** explicit local export/import of selected sessions and recordings with integrity, compatibility, and privacy controls.

**Gate:** owner selects data; manifest + SHA-256; metadata-only option; media inclusion explicit; import never overwrites newer canonical data silently; damaged/missing media handled; participant deletions remain authoritative; archive versioning; bounded import size; no automatic upload.

### 14I — Self-Hosted Operations, Budgets & Recovery V2
**Baseline: 7.5/10**

Existing:
- installer;
- roles/permissions;
- encrypted secrets;
- backup/verify/restore;
- audit log;
- foundation/security CI.

Missing:
- shallow runtime health UI;
- no provider budget dashboard;
- limited task/node/sync diagnostics;
- no guided maintenance mode.

**Target:** owner-facing operational diagnostics that make the standalone server understandable and repairable.

**Gate:** DB/key/storage health; provider configuration/health without secret disclosure; budget usage; multi-room node state; sync backlog/conflicts; task failures/retries; backup freshness; maintenance mode for restore; redacted diagnostic export; no destructive repair without confirmation.

### 14J — Final V0.14 Release Certification
**Baseline: 6.8/10**

**Target:** prove Sections 14A–14I compose safely without weakening V0.13's authority/privacy/reliability boundaries.

**Gate:** complete cross-section regression inventory; one-mic/one-transcript invariant; identity no-override; unknown/conflict preservation; deletion/revocation propagation; provider secret isolation; governed skill policy; bounded task execution; memory approval boundary; semantic recall provenance; sync consent/conflicts; multi-room no-teleport; recording archive integrity; self-host recovery; PWA/package integrity; deploy ZIP + SHA-256 + direct release.

## Recommended build order

The order above is intentional.

14A establishes the provider contract before tools/tasks depend on it. 14B establishes execution policy before 14C composes workflows. 14D and 14E then improve cognition without bypassing canonical evidence. 14F–14H expand optional persistence/federation portability. 14I hardens operations around the resulting runtime. 14J certifies the complete release.

## Initial overall score

**V0.14 readiness baseline: 6.5/10.**

The platform is structurally strong, but the useful-agent execution layer is still materially behind the perception and reliability layers. The largest immediate leverage is **14A + 14B + 14C**.

## Exact next action

After this planning PR is green and merged, begin **14A — Provider Runtime & Model Router** from the new merged `main`.

Do not write 14B runtime code until 14A is 10/10, green, merged, and post-merge verified.
