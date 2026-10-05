# Tracky2 — Standalone development checkpoint

**Resume rule:** read `docs/V012-MASTER-PLAN.md`, then inspect GitHub `main`, open PRs, current branch and CI. GitHub is authoritative. Tracky2 remains standalone.

## Completed and verified
- **V0.10A–10J** — complete.
- **V0.11A–11J** — complete at **V0.11.9**. Final V0.11 merge: `2cd4cda227b611fa7615019a8c3f1b42900edfc5`. Software delivery **10/10**.
- **V0.12 planning** — PR #54 merged at `07667d9f3a47fec2d3bf370bc8294d3d91836fb1`.
- **12A — Canonical Multimodal Identity Fusion** — PR #55 merged at `4a13ee8b1616a900ced3b4f5aaac0708cf4c6305`. Post-merge Node/package/PWA + PHP green. V0.12.0 artifact produced. **10/10**.
- **12B — Shared-Microphone Diarization** — PR #56 merged at `d8ae0b728851fa40bebfd8b90b65f588f3359e7d`. Post-merge Node/package/PWA + PHP green. V0.12.1 artifact produced. **10/10**.
- **12C — Continuous Camera + Voice Fusion** — PR #57 merged at `348244185c372cd9ca7420ec93b8f677aa3dcc23`. Post-merge Node/package/PWA + PHP green. V0.12.2 artifact produced. **10/10**.
- **12D — Real-Time Multi-Person Attribution** — PR #58 merged at `709155df72da0f9793e5034561f25ab523047c6f`. Post-merge Node/package/PWA + PHP green. V0.12.3 artifact produced. **10/10**.
- Physical camera/microphone representative-device evidence remains separate from CI.

## Active section: 12E — Recording & Session Identity Timeline
- **Branch:** `feat/v012e-session-identity-timeline`.
- **Audited baseline:** **7.2/10**. Dialogue/transcripts and ROOM observations used different session IDs, meeting metadata did not own the same session identity, and recall searched sources but did not expose one canonical session timeline.
- Added pure `src/session-identity-core.js` for canonical session lifecycle, same-tab reload recovery, bounded timeline projection, summary and JSON export.
- ROOM events, dialogue/transcripts and newly created meetings now share one `canonicalSessionId`.
- Session lifecycle metadata is stored separately in IndexedDB `session-identities` (DB v9). It stores only session ID/status/start/end/runtime metadata—never transcript text, ROOM messages, audio, video, images, embeddings or recording payloads.
- A per-tab runtime instance ID is held in `sessionStorage`. Reload recovery ends only older active sessions from that same tab as `reload-recovered`; other tabs are not closed.
- Best-effort `pagehide` closure ends the current session as `pagehide`. If that browser write does not complete, the next same-tab load repairs the stale active record.
- The AGENT Recall area now includes a selectable canonical session timeline. It is rebuilt live from current dialogue turns, persisted/current ROOM events and meetings, so transcript wording corrections and 12D speaker corrections appear without duplicating records.
- Missing linked meeting metadata is shown as an explicit stale reference instead of reconstructing deleted data.
- Participant deletion is reflected from the current canonical sources; the session timeline does not preserve a copied participant identity payload.
- Standalone Tracky2 currently has no saved-recording capture/store subsystem. 12E therefore adds a metadata-only recording-reference input to the pure timeline contract and **does not invent a second media capture path**. If/when a canonical recording source exists, its ID/timestamps can join the same session timeline without copying media.
- Session timeline JSON export is bounded and includes canonical projected text/metadata only; raw audio, PCM, video, photos and biometric embeddings are excluded.
- Meeting metadata now stores `sessionId`, and meeting UI starts each meeting inside the active canonical session.
- Release target: **V0.12.4** with package/PWA/runtime-audit/deploy-manifest wiring.
- Deterministic fixtures cover start/end/reload lifecycle, same-tab versus other-tab recovery, unified dialogue/ROOM/meeting/recording-reference projection, correction propagation, participant deletion, stale meeting references, bounded privacy-safe export, storage wiring and no sensor/storage/network side effects in the pure core.
- **Pre-CI score: 9.7/10.** Remaining 0.3 is full Node/package/PWA + PHP proof, PR merge, post-merge verification and V0.12.4 artifact validation.

## Exact next action
Open the 12E PR, repair only demonstrated failures, merge when all required checks are green, verify post-merge V0.12.4 packaging, score 12E **10/10**, then begin **12F — Multi-Room / Handoff Intelligence** from merged main.
