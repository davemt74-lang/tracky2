# Tracky2 self-hosted installation, encrypted participant sync and recovery

Tracky2 includes an optional PHP/SQLite server backend for the standalone browser application. It works on a self-hosted HTTPS website with PHP 8.1+, PDO SQLite and sodium. PHP cURL is additionally required only when using the V0.14 external provider runtime. No installation API key or external service is needed to create the first user. V0.10.7 adds additive schema migration, encrypted participant profiles, explicit browser/server participant synchronization, optimistic conflict handling and CLI backup/recovery.

## First-time setup

1. Extract the published deployment ZIP to the site directory and verify its SHA-256 checksum.
2. Ensure the account can create a private directory **outside** the web-accessible document root. By default the backend uses a private directory three levels above the server directory. Alternatively configure `TRACKY2_DATA_DIR` with an absolute path outside the web root and appropriate filesystem permissions.
3. Before granting general access to the host, visit `server/install.php` over HTTPS and choose a first-owner username and a password of at least 12 characters. The installer is one-time and records an installed lock; it refuses to overwrite an existing owner.
4. Sign in at `server/admin.php`. The Games screen also links to Self-hosted Admin. Configure additional users, roles and provider API keys as needed. The installer itself does not require any API key.

After installation, never remove `installed.lock` to reinstall or reset a password. Back up `tracky.sqlite` **and** `secret.key` together: the encryption key is not recreated after a completed installation.

## User types and permissions

Owner is the only default user allowed to change role permission grants and cannot be disabled through the UI. Owner/admin can create and manage accounts with roles below their own, including disabling users and changing their passwords. Operator can manage permitted participant and scene data; viewer can read limited metadata. The admin permission matrix controls precise grants for participants, scene capture, object review, skill approvals, user administration, and provider settings. APIs require a valid server session, live role permission check, and CSRF on writes; the viewer permission only exposes participant metadata (no stored face or voice samples).

## Participant storage and browser/server synchronization

Browser IndexedDB remains authoritative for ordinary standalone use and is never uploaded in the background. In Admin, **Review participant sync** compares only participant profiles from the current browser with the server. Each participant must be enabled separately. Face/voice embeddings or saved photographs require explicit participant consent before browser/server synchronization is enabled.

Synchronization is manual and participant-only in V0.10.7. Current conversation transcripts, ROOM events, AGENT memories, tasks, game history and scene data are not uploaded by this sync path. The browser stores only reconciliation metadata: enabled state, last acknowledged server version, local deletion tombstone and consent-confirmation time.

The server stores participant profile JSON encrypted at rest with the private instance `secret.key`. Each record has an optimistic version number and deletion tombstone. If both browser and server changed, Tracky2 does not merge silently: Admin shows a conflict and requires **Keep browser copy** or **Keep server copy**. Even a conflict resolution is tied to the server version the owner reviewed; a newer unseen server change re-opens the conflict.

Offline or failed sync attempts leave browser and server records unchanged except for already-saved local reconciliation metadata. Refreshing the manual sync screen later recomputes the correct action from current browser data, server version and deletion state.

## Multi-room node runtime

V0.13.3 adds an optional same-origin room-node relay for self-hosted Tracky2. A signed-in owner, admin or operator with `rooms.read` and `rooms.write` can run separate browser/camera nodes in distinct physical rooms against the same Tracky2 installation.

Each live node sends a bounded heartbeat containing only node ID, owner-defined room ID/name, runtime instance ID, primary preference and timestamps. The relay accepts only four bounded event types: participant observed, participant out of view, explicit handoff declared and explicit departure confirmed. It does **not** upload camera frames, audio, transcripts, embeddings, room screenshots or AGENT memory.

The server timestamps every accepted observation, deduplicates event IDs, expires stale nodes/events and returns only recent runtime metadata. Clients normalize remote event time against server receipt time so large clock skew cannot manufacture a room transition. If two current rooms report the same participant without an explicit handoff, Tracky2 records a conflict and does not infer a route. If more than one camera node serves the same room, deterministic primary-node arbitration prevents every node from publishing duplicate presence observations.

The relay is optional. If the server session, permission or endpoint is unavailable, the browser stays **local-only** and the existing single-room runtime continues normally. No third-party cloud service is used.

## LLM and voice providers

Admin can securely save/replace/remove encrypted OpenAI (ChatGPT API), Anthropic (Claude), and ElevenLabs API keys. Credentials never appear in the browser after saving or enter a release ZIP.

V0.14.0 adds an authenticated same-origin provider runtime. OpenAI and Anthropic chat requests are constructed on the server from bounded text-only conversation messages; the browser never receives the stored key and cannot supply an arbitrary upstream URL. Models are allowlisted server-side. The owner can grant or revoke `providers.use` independently of `providers.manage`; owner/admin/operator receive provider-use permission by default while viewer does not.

Provider use has both persistent daily and authenticated-session request/unit budgets. Three consecutive provider failures open a short per-session circuit breaker; successful requests reset it. Provider audit records contain only provider/model/outcome/unit metadata, never prompt/reply text, biometrics, recordings or credentials. The existing loopback-only Ollama path remains available without using the server budget.

ElevenLabs is optional speech output only. Tracky sends at most the bounded reply text plus an owner-entered voice ID to the same-origin provider endpoint; the API key stays server-side. If provider speech fails, AGENT falls back to the existing browser/system voice. External provider routing requires PHP cURL; when cURL is missing the runtime reports transport unavailable and local/scripted operation continues.

## Scene and object foundation

Authorized `server/api.php?resource=scenes|objects|skills` requests store scenes, proposed/approved objects with normalized bounding boxes, and per-object allowlisted skills. V0.14.1 connects those permissions to the AGENT task runtime through an explicit governed-skill registry.

Local owner-defined objects can explicitly grant `describe_object` and `capture_image`. Capture requires a mapped camera area, visible active camera and a fresh foreground owner action; it cannot execute from the background scheduler. The captured crop is downloaded locally as a one-time JPEG and Tracky stores only bounded dimensions/byte-count provenance, not image bytes.

Self-hosted approved objects can explicitly grant `describe_object` and `product_search`. Product search requires `skills.execute` plus `providers.use`, rechecks current object approval and current enabled-skill state at execution time, and uses only the configured server-side OpenAI credential through a fixed endpoint. The browser sends only the object ID and fixed skill name. Revoking object approval disables all server skill grants immediately. Search results retain only bounded summary text and up to five unique HTTPS source references.

No governed skill can run arbitrary shell commands, arbitrary URLs, raw camera/audio uploads, biometric payloads, participant identity changes, transcript changes, memory writes or hidden recording. Owner/admin can review approved self-hosted objects and enable/revoke server skills in Admin.

V0.14.2 adds local workflow orchestration over those governed skills. Workflows contain bounded dependency metadata and policy snapshots only; they are not uploaded to the server. Before a self-hosted workflow step runs, the browser refreshes the current approved-object/skill inventory, and `server/skill-api.php` revalidates the object and grant again. A revoked object, removed skill, stale authorization snapshot, or deleted dependent participant invalidates the workflow instead of continuing under old authority. Reloaded workflows remain paused until the owner resumes them, and an interrupted external-search step is never silently repeated.

V0.14.3 adds owner-approved memory learning entirely in the browser. Proposal generation reads current canonical dialogue, ROOM decisions and meeting metadata into a bounded in-memory review queue; it does not add a server memory endpoint or sync proposals. Participant-scoped proposals require resolved single-speaker attribution or an owner correction. Source IDs/fingerprints are revalidated before approval, sensitive inferred categories are suppressed, and only the owner's explicit Approve & save action can write a schema-2 durable memory. Approved memories retain bounded provenance metadata only; canonical source excerpts, transcripts, raw media, biometrics, provider prompts and credentials are not copied into the memory store.

## Backup, restore and offline recovery

Use the CLI-only recovery tool from the application directory:

`php server/backup.php create /private/path/tracky2-backup`

`php server/backup.php verify /private/path/tracky2-backup`

`php server/backup.php restore /private/path/tracky2-backup --yes`

A backup contains `tracky.sqlite`, `secret.key`, `installed.lock` and a SHA-256 manifest. Verification runs SQLite integrity checks and confirms the included key can decrypt participant data. Restore requires the explicit `--yes` flag and creates a separate pre-restore recovery point first. Run restore during a maintenance window so no web request is writing the database.

## Verification and deployment

CI validates PHP syntax/extensions, fresh install, legacy-schema upgrade, one-time installer lock, SQLite permissions, CSRF, encrypted participant sync, multi-room node tables/permissions, conflict detection, provider encryption/recovery, governed skill permissions/revocation contracts, backup verify/restore, JavaScript reconciliation tests, PWA tests, and ZIP package integrity. Personal camera, microphone and participant consent still require device-level acceptance. The deployment archive includes recovery tooling and server runtime code, **never** the live private database, passwords, provider credentials or encryption key.
