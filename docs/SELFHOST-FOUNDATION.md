# Tracky2 self-host foundation (development branch)

This branch is an initial backend, not a deployable replacement for v0.7.2.

## Runtime and install
Requires PHP 8.1+, PDO SQLite, sodium, HTTPS, persistent writable directory **outside the web root** at `dirname(__DIR__,2)/tracky2-private` relative to `server/bootstrap.php`. The hosting account must permit this location. Do not expose the server source files or private directory for download. Visit `server/install.php` once and create an owner username and password (12+ characters). No installation API key. Installation locks itself after first successful owner creation; delete neither the lock nor database during upgrades. Sign in through `server/admin.php`.

## Roles
Owner receives immutable initial permissions. Admin, operator and viewer have seeded default permissions. Owner alone may edit role grants. Authorized users can create additional users. User disable/delete and account recovery are planned before production release.

## LLM & Voice Providers
In Admin, authorized owner/admin manages OpenAI (ChatGPT models), Anthropic (Claude) and ElevenLabs. Keys are encrypted using PHP sodium secretbox and an instance-local key file outside the served root, restricted to filesystem mode 0600. Keys are never displayed after saving or returned by browser APIs. Backup of BOTH database and instance secret key is required; losing secret key makes saved provider credentials unrecoverable. Key deletion and replacement are audited. These are provider configuration records: model calls, spending limits, provider health checks, per-skill routing and ElevenLabs playback are NOT wired into the existing browser conversation engine in this branch.

## Participant & scene persistence
The authenticated `server/api.php?resource=participants|scenes|objects|skills` endpoint stores records under SQLite. POST requires the session CSRF token. Scene object bounding boxes are normalized relative coordinates; detections start proposed until explicitly approved. Approved objects may be assigned an allowlisted skill (capture_image, product_search, describe_object) by authorized users. This is registry metadata and DOES NOT execute network calls or device actions. Model inference, gallery snapshot storage, object-detection UI, media retention, participant IndexedDB migration and admin CRUD lifecycle are outstanding. No background scene capture occurs in this foundation.

## Production gates
- Add backend PHPUnit/CLI security tests and CI PHP job; test concurrent installer requests and role changes.
- Introduce same-origin login/session UI and explicit consent-based migration from browser IndexedDB to the server; never silently move biometrics.
- Wire scene classifier to the canonical camera pipeline, add review/deduplication of object tracks, capture policy and delete/retention controls.
- Implement provider model calls server-side with network allowlists, quota controls, timeout and outbound data minimization.
- Connect approved object skills to governed tool execution and explicit user confirmation for external searches or captures.
- Preserve v0.7.2 PWA/ZIP release until all integration and deployment checks are green. No production deployment or release is asserted by this branch.
