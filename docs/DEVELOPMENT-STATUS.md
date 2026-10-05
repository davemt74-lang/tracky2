# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V013-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. Tracky2 remains standalone.

## Completed and verified
- **V0.10A–10J** — complete.
- **V0.11A–11J** — complete at **V0.11.9**. Final V0.11 merge: `2cd4cda227b611fa7615019a8c3f1b42900edfc5`. Software delivery **10/10**.
- **V0.12 planning** — PR #54 merged at `07667d9f3a47fec2d3bf370bc8294d3d91836fb1`.
- **12A — Canonical Multimodal Identity Fusion** — PR #55 merged at `4a13ee8b1616a900ced3b4f5aaac0708cf4c6305`. **10/10**.
- **12B — Shared-Microphone Diarization** — PR #56 merged at `d8ae0b728851fa40bebfd8b90b65f588f3359e7d`. **10/10**.
- **12C — Continuous Camera + Voice Fusion** — PR #57 merged at `348244185c372cd9ca7420ec93b8f677aa3dcc23`. **10/10**.
- **12D — Real-Time Multi-Person Attribution** — PR #58 merged at `709155df72da0f9793e5034561f25ab523047c6f`. **10/10**.
- **12E — Recording & Session Identity Timeline** — PR #59 merged at `3420c5a1402cae6b55c2748a04c5a356e8b56558`. **10/10**.
- **12F — Multi-Room / Handoff Intelligence** — PR #60 merged at `f13168c9b5f338fac73d3d653679865ad339429e`. **10/10**.
- **12G — Advanced Spatial + Audio Source Intelligence** — PR #61 merged at `306c9c7007b29253a874d421c602fcf0906f9867`. **10/10**.
- **12H — Agent Multimodal Reasoning** — PR #62 merged at `20ce21e5fa370be2a5b7f0b65ad01346206efa50`. **10/10**.
- **12I — Long-Session / Stress Hardening** — PR #63 merged at `4abdea292eaf65df0da1fb8a46563cd5d6ec4690`. V0.12.8 post-merge Node/package/PWA + PHP green and deploy artifact verified. **10/10**.
- **12J — V0.12 Release** — PR #64 merged at `7cea628b8d4ebbce8c5573c40d4b2f124e0b37fd`. V0.12.9 post-merge Node/package/PWA + PHP green; deploy artifact and direct GitHub release published with verified SHA-256 `c58e212a04f98cd5857c740bc3d4b7263d18a4337652a2b44b03523d0473e41f`. **10/10**.
- **Complete V0.12 software delivery:** **10/10**.
- Physical camera/microphone/multi-speaker representative-device evidence remains separate from CI.

## Completed release: V0.12.9
- **Branch:** `feat/v012j-final-release`.
- Final release target: **V0.12.9**.
- Added pure `src/v012-release-core.js` with the complete A–I software gate, canonical runtime-bound checks, one-mic/one-transcript/no-identity-shortcut evidence boundaries, artifact integrity checks and an explicit `universalHardwareClaim:false` result.
- Added `docs/V012-RELEASE-ACCEPTANCE.md` documenting every V0.12 section, privacy/deletion invariants, accessibility regression requirements and the separate physical-device evidence boundary.
- Added deterministic 12J release regressions covering every 12A–12I test file, one live room microphone, canonical identity/deletion behavior, AGENT no-override, PWA shell contents, final package/version/checksum wiring and pure release-core safety.
- Package and runtime audit now require **V0.12.9**, `src/v012-release-core.js` and the V0.12 acceptance document.
- PWA cache is **tracky2-static-v0.12.9** and contains the V0.12 release core alongside all A–I runtime modules.
- CI builds `tracky2-v0.12.9-deploy.zip`, verifies the complete V0.12 runtime/acceptance artifacts, smoke-imports the V0.12 release core, produces `tracky2-v0.12.9-deploy.zip.sha256`, uploads both and publishes a direct GitHub release on merged `main`.
- Diagnostics hardware-evidence export reports **0.12.9** while continuing to state that representative-device evidence is not universal hardware certification.
- No new camera, microphone, transcript, identity, storage or network authority is introduced by 12J.
- **Final score: 10/10.** PR #64, post-merge CI, V0.12.9 artifact, direct release asset and SHA-256 are verified.

## V0.13 planning
- **V0.13 — Real-World Agent Intelligence & Reliability** is defined in `docs/V013-MASTER-PLAN.md`.
- Planning PR #66 merged at `4086ee2ce24a310b779f65e2c890de5453f27301` with green post-merge CI.
- Section baselines: **13A 7.4**, **13B 5.8**, **13C 7.6**, **13D 6.3**, **13E 5.4**, **13F 6.8**, **13G 5.9**, **13H 7.3**, **13I 7.9**, **13J 6.6**.
- V0.12 remains closed. V0.13 extends the existing canonical runtime and does not create parallel microphone, transcript, participant, memory or hidden-recording authorities.

## Completed V0.13 sections
- **13A — Representative Hardware Certification** — PR #67 merged at `27916ab492d8c6b9e1f8e9d4c5550754ea3b3660`. Post-merge green; direct **v0.13.0** ZIP + SHA-256 published. **10/10**.
- **13B — Overlapping-Speaker Source Separation V2** — PR #68 merged at `79bd3443c7f7cd3907646034ebf59204a51248f3`. Post-merge green; direct **v0.13.1** ZIP + SHA-256 published. **10/10**.
- **13C — Advanced Participant Continuity** — PR #69 merged at `d65b27a6403ffcb049d14ed38eddbc89277f7ddd`. Post-merge green; direct **v0.13.2** ZIP + SHA-256 published. **10/10**.
- **13D — Multi-Room Runtime V2** — PR #70 merged at `d257ae9013ad9cb1b722fa9821d2a861fc0fc58e`. Post-merge green; direct **v0.13.3** ZIP + SHA-256 published. **10/10**.
- **13E — Recording & Recall Runtime** — PR #71 merged at `55582f5689d3def80b7e84995936a31155289492`. Post-merge green; direct **v0.13.4** ZIP + SHA-256 published. **10/10**.
- **13F — Environmental Intelligence V2** — PR #72 merged at `8b6f303351c4a08eb57d7909b52ea8ddf5506af0`. Post-merge green; direct **v0.13.5** ZIP + SHA-256 published. **10/10**.
- **13G — Behavioral & Routine Intelligence** — PR #73 merged at `75c23d76982a7ad385c1cea70c492aca2225d75e`. Post-merge Node/package/PWA + PHP green; direct **v0.13.6** ZIP + SHA-256 published. **10/10**.
- Representative hardware evidence remains specific to the tested device/browser/environment and is not universal certification.

## Completed V0.13 section: 13H — Proactive Agent Intelligence V3
- PR #74 merged at `e5994ebc3544fdb70a5bbdd3d5e1df845aed3adb`.
- Post-merge Node/package/PWA + PHP green; direct **v0.13.7** ZIP + SHA-256 published.
- Explicit usefulness/urgency/confidence ranking, semantic-repeat suppression, bounded session follow-up planning, routine opportunities and all prior interruption/identity/privacy gates are verified.
- **Final score: 10/10.**

## Completed V0.13 sections
- **13A — Representative Hardware Certification** — PR #67 merged at `27916ab492d8c6b9e1f8e9d4c5550754ea3b3660`. Post-merge green; direct **v0.13.0** ZIP + SHA-256 published. **10/10**.
- **13B — Overlapping-Speaker Source Separation V2** — PR #68 merged at `79bd3443c7f7cd3907646034ebf59204a51248f3`. Post-merge green; direct **v0.13.1** ZIP + SHA-256 published. **10/10**.
- **13C — Advanced Participant Continuity** — PR #69 merged at `d65b27a6403ffcb049d14ed38eddbc89277f7ddd`. Post-merge green; direct **v0.13.2** ZIP + SHA-256 published. **10/10**.
- **13D — Multi-Room Runtime V2** — PR #70 merged at `d257ae9013ad9cb1b722fa9821d2a861fc0fc58e`. Post-merge green; direct **v0.13.3** ZIP + SHA-256 published. **10/10**.
- **13E — Recording & Recall Runtime** — PR #71 merged at `55582f5689d3def80b7e84995936a31155289492`. Post-merge green; direct **v0.13.4** ZIP + SHA-256 published. **10/10**.
- **13F — Environmental Intelligence V2** — PR #72 merged at `8b6f303351c4a08eb57d7909b52ea8ddf5506af0`. Post-merge green; direct **v0.13.5** ZIP + SHA-256 published. **10/10**.
- **13G — Behavioral & Routine Intelligence** — PR #73 merged at `75c23d76982a7ad385c1cea70c492aca2225d75e`. Post-merge green; direct **v0.13.6** ZIP + SHA-256 published. **10/10**.
- **13H — Proactive Agent Intelligence V3** — PR #74 merged at `e5994ebc3544fdb70a5bbdd3d5e1df845aed3adb`. Post-merge green; direct **v0.13.7** ZIP + SHA-256 published. **10/10**.
- **13I — Performance / Long-Run Device Hardening V2** — PR #75 merged at `f5548fb20555447c975c28bb19ac2f4b6a12b73b`. Post-merge green; direct **v0.13.8** ZIP + SHA-256 published. **10/10**.
- Representative hardware evidence remains configuration-specific and is not universal certification.

## Completed V0.13 release
- **13J — V0.13 Release Certification** — PR #77 merged at `6daf78a6635f6f014b08dc7dd8783c3e0e2ddc16`.
- Post-merge Node/package/PWA and PHP foundation/security checks are green.
- Direct **v0.13.9** release published against the merged commit with `tracky2-v0.13.9-deploy.zip` and `tracky2-v0.13.9-deploy.zip.sha256`.
- Final V0.13 release core, acceptance document, 13A–13I regression inventory, runtime bounds, authority boundaries, representative-device scope and package integrity are verified.
- Representative-device hardware evidence remains configuration-specific and is **not universal hardware certification**.
- **13J final score: 10/10.**
- **Complete V0.13 software delivery: 10/10.**

## Exact next action
Do **not** restart V0.13 Sections 13A–13J. V0.13.9 is complete. Any further work begins as a new explicitly planned release from merged `main`. Representative physical-device evidence may continue as separate certification evidence, not as unfinished V0.13 software work.

## V0.14 planning

- **V0.13 remains closed. Do not restart Sections 13A–13J.**
- V0.14 is defined in `docs/V014-MASTER-PLAN.md` as **Governed Agent Capability & Self-Hosted Intelligence**.
- Audited starting point: merged `main` `a54a73c15a5846c318f02d808b3ed7807637e962`.
- Initial V0.14 readiness baseline: **6.5/10**.
- Section baselines: **14A 5.8**, **14B 4.9**, **14C 6.1**, **14D 6.4**, **14E 7.1**, **14F 5.6**, **14G 7.3**, **14H 7.0**, **14I 7.5**, **14J 6.8**.
- Priority sequence begins with **14A Provider Runtime & Model Router**, then **14B Governed Skills & Tool Execution**, then **14C Agent Tasks & Workflow Execution V2**.
- Tracky2 remains standalone. No VP3 Cloud/HomeServer dependency is introduced by the V0.14 plan.
- Stale PR #76 was closed as superseded by merged PRs #77 and #78.

## V0.14 planning merged

- Planning PR #79 merged at `7b29ee27c2314413c94701600211684272f80501` after green CI.
- V0.13 remains closed.

## 14A — Provider Runtime & Model Router

- Branch: `feat/v014a-provider-runtime-router`.
- Release target: **v0.14.0**.
- Added a pure provider-routing contract with bounded text projection, fixed model allowlists/defaults, deterministic remote fallback ordering and budget presentation.
- Added authenticated same-origin server routing for OpenAI Responses API and Anthropic Messages API; credentials remain encrypted server-side and are never returned to browser JavaScript.
- Added optional ElevenLabs text-to-speech through the same credential boundary with bounded reply text and owner-entered voice ID; browser/system speech remains fallback.
- Added independent `providers.use` permission, schema-v4 persistent daily usage accounting, authenticated-session budgets, bounded timeout/retry behavior, short circuit breaker, and privacy-safe provider audit metadata.
- AGENT retains local Ollama and deterministic scripted reply paths. Provider routing does not gain identity, microphone, transcript, memory, meeting, recording, room-handoff or deletion authority.
- Package/PWA/diagnostics/CI are aligned to **v0.14.0** with provider-runtime smoke tests and direct ZIP/SHA release wiring.
- PR #80 merged at `6307a348dc387bbe174a57bd99c721d80387c228`.
- Post-merge Tracky2 CI run #37345890199 passed Node/package/PWA and PHP/security/installer checks.
- Direct **v0.14.0** release published against the merged commit with `tracky2-v0.14.0-deploy.zip` and `tracky2-v0.14.0-deploy.zip.sha256`.
- Verified deploy ZIP SHA-256: `be5a0794bd64f0d0cd47141931954fbf9bb86d8c74edd733dee39e0ce69929d0`.
- **14A final score: 10/10.**

## 14B — Governed Skills & Tool Execution

- Branch: `feat/v014b-governed-skills`.
- Release target: **v0.14.1**.
- Added explicit governed skill capability classes for read-only metadata, foreground media capture and external network search.
- Local owner-defined objects now carry per-object grants. `capture_image` requires an explicitly granted mapped camera area, visible active camera and a fresh owner action; it cannot run from the background scheduler.
- Self-hosted approved objects are combined with enabled `object_skills`. `product_search` is server-approved-only and revalidates current object approval + current skill enablement immediately before execution.
- Added independent `skills.execute` permission in schema v5; owner/admin/operator receive it by default while viewer remains denied unless deliberately granted.
- Product search uses the existing encrypted OpenAI key through a fixed same-origin `server/skill-api.php` adapter. Browser requests contain only `{skill, objectId}`; arbitrary commands, search text, URLs, endpoints and credentials are not accepted.
- Search results retain bounded summary text plus at most five HTTPS source references. Camera capture downloads the crop locally and task history stores only bounded byte/dimension provenance, never image bytes.
- Every successful execution records bounded skill contract/version, side-effect class, target source, authorization state and result metadata. Revoking a server object disables its skill grants.
- Package/PWA/diagnostics/CI are aligned to **v0.14.1**, including governed runtime/server endpoint smoke checks and direct ZIP/SHA publication.
- PR #82 merged at `61cdf6c3998dab77e680eeda832064be39fc3914`.
- Post-merge Tracky2 CI run #37351484130 passed Node/package/PWA and PHP/security/installer checks.
- Direct **v0.14.1** release published against the merged commit with `tracky2-v0.14.1-deploy.zip` and `tracky2-v0.14.1-deploy.zip.sha256`.
- Verified deploy ZIP SHA-256: `a6a2c0d5b21bc44d0210c1df901005bb9d5756d669ef4f93d09b5a304627332d`.
- **14B final score: 10/10.**

## 14C — Agent Tasks & Workflow Execution V2

- Branch: `feat/v014c-workflow-execution-v2`.
- Release target: **v0.14.2**.
- Added a bounded workflow model with at most six dependency-ordered steps, immutable policy snapshots, stable per-step idempotency keys, attempt tracking and explicit terminal/recovery states.
- Added deterministic presets only: local `describe → capture` and self-hosted `describe → product search`. No free-form command/tool-chain editor is introduced.
- Workflow confirmation may continue read-only steps, but every capture/network step still stops for a fresh foreground owner action. Background workflow execution cannot elevate a 14B skill grant.
- Current target existence, object approval, skill enablement, authorization fingerprint and optional participant dependency are revalidated before execution. Deletion/revocation/stale authorization invalidates the workflow.
- Restart recovery never auto-resumes a saved workflow. Interrupted read-only steps become pending; interrupted side-effect steps enter `needs-review` and require explicit owner retry.
- Cancellation is authoritative between steps and remains authoritative if an in-flight step later fails. Retry classification separates transient, owner-action, authorization and terminal failures.
- Added visible workflow progress, per-step outcomes/sources, recovery controls and bounded local persistence in IndexedDB schema 13 with an 80-workflow cap.
- Workflow persistence stores only policy/step/status/result/provenance metadata; no raw media, embeddings, credentials, prompts or arbitrary tool payloads.
- Repaired the 14B runtime connection so the existing foreground camera capture executor is passed into both single-task and workflow execution.
- Package/PWA/diagnostics/CI are aligned to **v0.14.2**, including workflow core/UI smoke checks and direct ZIP/SHA publication.
- PR #84 merged at `dad63a3ddea6d0235fc9ec8099a47a1d4648f293`.
- Post-merge Tracky2 CI run #37353574045 passed Node/package/PWA and PHP/security/installer checks.
- Direct **v0.14.2** release published against the merged commit with `tracky2-v0.14.2-deploy.zip` and `tracky2-v0.14.2-deploy.zip.sha256`.
- Verified deploy ZIP SHA-256: `604226053d6f36164f84e03cd49faab280aa78b85413c6f84200d7ea9eb88ed2`.
- **14C final score: 10/10.**

## 14D — Owner-Approved Memory Learning V2

- Branch: `feat/v014d-owner-approved-memory-v2`.
- Release target: **v0.14.3**.
- Added a bounded session-only memory proposal engine; proposals are never persisted and only explicit owner approval can create durable memory.
- Proposal sources are limited to canonical dialogue, owner ROOM decisions, owner meeting notes and owner-marked meeting decisions. Each proposal carries bounded source IDs, excerpts for review and source fingerprints.
- Participant-scoped dialogue proposals require canonical resolved single-speaker attribution with no unresolved/partial ownership; explicit owner speaker corrections may restore eligibility.
- Automatic proposal generation recognizes only narrow explicit preference/remember statements and suppresses health/medical, emotion/mood, protected-trait, criminal-history, financial-sensitive and precise-location content.
- Added duplicate/related/contradiction review against active owner memory. Duplicates are blocked; contradictory approval requires owner confirmation and atomically saves the new memory while revoking the conflicting records.
- Owner can edit proposal text/type and choose expiry before saving. Proposal-derived relationship inference is not allowed.
- Durable memory schema advances to 2 only to preserve `owner-approved-proposal` provenance, approval time, proposal method and up to five canonical source IDs/fingerprints. Source excerpts/transcripts are not copied into durable memory.
- Canonical source deletion/correction or speaker-eligibility changes invalidate a pending proposal before approval. Participant deletion removes directly scoped memories and proposal-derived memories referencing that participant.
- Runtime proposal refresh follows new/corrected dialogue and meeting changes without writing memory. Meeting metadata is exposed read-only to the memory review UI.
- Package/PWA/diagnostics/CI are aligned to **v0.14.3**, including memory-learning syntax/smoke/package checks and direct ZIP/SHA publication.
- PR #86 merged at `590005d8da3252f00275c4c47f77958b14361deb`.
- Post-merge Tracky2 CI run #37356747284 passed Node/package/PWA and PHP/security/installer checks.
- Direct **v0.14.3** release published against the merged commit with `tracky2-v0.14.3-deploy.zip` and `tracky2-v0.14.3-deploy.zip.sha256`.
- Verified deploy ZIP SHA-256: `6f2d500e89cff540e9183863587dd06be2f1cfac00612395cbdbe2b1a997f38c`.
- **14D final score: 10/10.**

## Exact next action

Begin **14E — Recall & Search Intelligence V2** from current merged `main`. Do not reopen 14D.

