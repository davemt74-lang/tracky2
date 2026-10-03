# Tracky2 V0.8.0: self-hosted installation and persistent database

Tracky2 V0.8.0 includes the entire v0.7.4 AGENT experience and an optional PHP/SQLite server backend. It works on a self-hosted HTTPS website with PHP 8.1+, PDO SQLite and sodium. No installation API key or external service is needed to create the first user.

## First-time setup

1. Extract the v0.8.0 deployment ZIP to the site directory and verify the published SHA-256 checksum.
2. Ensure the account can create a private directory **outside** the web-accessible document root. By default the backend uses a private directory three levels above the server directory. Alternatively configure `TRACKY2_DATA_DIR` with an absolute path outside the web root and appropriate filesystem permissions.
3. Before granting general access to the host, visit `server/install.php` over HTTPS and choose a first-owner username and a password of at least 12 characters. The installer is one-time and records an installed lock; it refuses to overwrite an existing owner.
4. Sign in at `server/admin.php`. The Games screen also links to Self-hosted Admin. Configure additional users, roles and provider API keys as needed. The installer itself does not require any API key.

After installation, never remove `installed.lock` to reinstall or reset a password. Back up `tracky.sqlite` **and** `secret.key` together: the encryption key is not recreated after a completed installation.

## User types and permissions

Owner is the only default user allowed to change role permission grants and cannot be disabled through the UI. Owner/admin can create and manage accounts with roles below their own, including disabling users and changing their passwords. Operator can manage permitted participant and scene data; viewer can read limited metadata. The admin permission matrix controls precise grants for participants, scene capture, object review, skill approvals, user administration, and provider settings. APIs require a valid server session, live role permission check, and CSRF on writes; the viewer permission only exposes participant metadata (no stored face or voice samples).

## Participant storage and migration

Legacy browser IndexedDB data is not automatically uploaded or deleted. In Admin, **Review browser profiles** lists records only from the current browser. Choose each profile individually and confirm its participant has consented to moving their photos/face/voice profile. Approved selections are copied into private server-side SQLite; local profiles remain until you deliberately delete them. A single server session endpoint at `server/session.php` returns login state, authorized permissions and a same-origin CSRF token for future UI integrations.

The existing browser-only camera/participant pages still use their original local data until synchronized deliberately. Real-time bidirectional participant synchronization, complete deletion/retention tools and multi-device reconciliation are follow-up sections; do not assume existing local camera records are automatically mirrored after installation.

## LLM and voice providers

Admin can securely save/replace/remove encrypted OpenAI (ChatGPT API), Anthropic (Claude), and ElevenLabs API keys. Credentials never appear in the browser after saving or enter a release ZIP. Configuring credentials does not yet enable live provider routing: the existing local AGENT/Ollama path remains available, while provider calls, spending limits and voice synthesis integration are separate work.

## Scene and object foundation

Authorized `server/api.php?resource=scenes|objects|skills` requests store scenes, proposed/approved objects with normalized bounding boxes, and per-object allowlisted skills (`capture_image`, `product_search`, `describe_object`). A proposed object must be approved before any skill can be enabled. These records are data and permissions, not unrestricted commands. The live object-detection model, scene snapshots, governed tool execution, external searches and retention policies need dedicated integration before scene intelligence is usable end-to-end.

## Verification and deployment

CI validates PHP syntax/extensions, real first-owner installation and login, the one-time installer lock, SQLite permissions, CSRF handling, provider encryption/recovery, existing JavaScript/PWA tests, and ZIP package integrity. Personal camera, microphone, participant consent and any configured provider calls require device-level acceptance. The deployment archive includes server runtime PHP/JS and documentation, **never** the private database, passwords, provider credentials or encryption key.
