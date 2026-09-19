# Pocket Vault security audit — updated for version 1.2

Scope: the saved Pocket Vault 1.0 source archive, website, browser extension, its two live Supabase tables, and the new optional Node server. The starting local source was checked against the saved archive. This review did not test an unknown deployed GitHub URL or inspect the user's computer.

Result: identified gaps were corrected in code, server-side validation was added, and vault database hardening was applied to the connected project. This is a code review with regression tests and live authorization checks, not an external penetration-test certification or a promise that attacks are impossible.

## Findings and fixes

| Finding in the previous implementation | Risk | Current behavior |
|---|---|---|
| Input restrictions were inconsistent outside HTML forms; returned encrypted records were not fully schema-checked | Malformed input, resource exhaustion, or broken UI behavior | Shared exact-field schemas validate all credential, login, envelope, UUID, revision, and API-filter boundaries. Database checks independently validate envelope size/format. |
| Raw provider error messages were displayed | Possible account/backend detail disclosure | Fixed safe messages replace raw auth/database response errors. No request bodies or credentials are logged. |
| A delayed sign-in/refresh/read could complete after local lock | Session resurrection or stale data display | Abortable requests, generation checks, single-flight refresh, immediate UI clearing, and checks before revealing/copying/saving. |
| Idle interaction could reset the clock after a suspended tab resumed | Continued access after intended timeout | The eight-hour absolute lifetime is checked before access. At the owner's request, 1.2 disables the five-minute idle lock; use manual Lock when leaving the device. |
| Lock cleared local extension state without confirming upstream revocation | Stolen access tokens could outlive local unlock state | Lock attempts local-scope provider sign-out. RLS now requires the signed JWT's session to still exist in Auth. Failures to confirm sign-out are reported by the vault screen. |
| Owner checks did not check live sessions, confirmation, bans, or existing MFA | Revoked/insufficiently authenticated sessions could continue using data APIs | Restrictive policies require ownership, live matching Auth session, confirmed email, no active ban, less than eight-hour session age, and aal2 if any verified factor exists. |
| Client could submit arbitrary timestamps/revisions within its own rows | Integrity and conflict-detection weaknesses | Column privileges forbid client updates to owner, ID, and timestamps. Trigger sets timestamps and enforces initial revision 1 and increments of exactly 1. |
| Extension SAVE authorization relied on a content-script request from page UI | Approval placed in a page-controlled surface | SAVE is accepted only from exact extension-owned UI pages. The banner can only open a separate review page. Wrong sender, frame, origin, tab, ID, or message fields are rejected. |
| Extension work and pending captures were not bounded tightly | Memory/queue abuse | 20 pending logins, five-minute expiry, per-tab capture pacing, 64 queued operations, bounded input, and lock preemption. |
| Web encryption keys were exportable unnecessarily | Easier raw-key extraction following client compromise | Website CryptoKeys are non-extractable. The extension temporarily exports only for its trusted session store and imports operational keys as non-extractable. |
| Static hosting had no server cookie/CSRF architecture | Could not honestly provide HttpOnly cookie protection | Added same-origin Node server with opaque HttpOnly/Secure/SameSite=Strict cookies, encrypted session storage, synchronized CSRF tokens, and server rate limits. |
| A CSP meta tag could not supply anti-framing HTTP protection | Clickjacking gaps on static hosting | Added frame guard and tighter meta CSP; Node mode adds enforced `frame-ancestors 'none'`, X-Frame-Options, HSTS, nosniff, Permissions-Policy, and no-store headers. |

The review found no existing raw SQL construction from vault form input, no shell execution of user data, and no use of `innerHTML` to render saved logins. Those patterns were preserved rather than claiming an injection exploit had been found.

## Coverage of the requested controls

### 1. Injection and validation

- Login/email/account passwords, master-password length, every saved-login field, IDs, revisions, envelope versions/base64 sizes, message types, and server JSON bodies are checked in code.
- Unknown fields and unexpected types are rejected. API query keys are allowlisted and values are validated before interpolation.
- Server SQL uses parameter bindings. Supabase record IDs are UUIDs, not arbitrary SQL/filter text. No application route executes shell commands.
- User-controlled text is assigned through textContent or input.value. HTML-looking names remain inert text. Password characters are preserved exactly; passwords are never “sanitized” by removing legitimate characters.
- Website values require HTTPS without embedded credentials. Query strings and fragments are removed before a login's website address is stored.
- Decrypted data is untrusted until it passes the same schema as manual input. There are no remote favicons or analytics requests disclosing saved domains.

### 2. Authentication and sessions

- Static/extension auth tokens remain only in memory; no token is added to localStorage, IndexedDB, a URL, or a log.
- Node mode returns an opaque cookie, never a Supabase access/refresh token. Cookie IDs are hashed before storage; session payloads are encrypted with a deployment-only secret.
- Idle locking is disabled in 1.2 at the owner's request. The eight-hour absolute lifetime remains enforced by the app, extension, Node server, and live-session database policies. A pre-authentication Node CSRF handshake and pending extension captures still expire after five minutes; neither is an authenticated-vault idle timeout.
- Sign-in requests are serialized in the UI. Local cooldowns slow repeated attempts, but these are bypassable client controls, not an Internet brute-force defense.
- Node mode enforces persistent IP/email request limits and generic auth failures. Direct Supabase calls remain subject to Supabase's separate provider limits; current project rate-limit settings were not exposed by the connected tools and were not changed.
- Existing TOTP MFA challenges are supported. Any verified factor requires aal2 in the data policy. New MFA enrollment and CAPTCHA widgets are not implemented.
- Client and server requests avoid redirects when carrying credentials. Stale requests are aborted and checked before applying responses.

### 3. Access control and BOLA

- Both vault tables have RLS enabled and forced. Owner checks are restrictive as well as permissive, so adding a broad permissive policy later does not override the restrictive guard.
- Anonymous roles receive no table access. Anonymous Auth users are rejected too.
- The new private session-check function has a fixed empty search_path, explicitly checks auth.uid and session ownership, performs no dynamic SQL or writes, and is executable only by authenticated callers. Its schema is not a public Data API schema.
- Metadata remains immutable to public clients. Item IDs, owners, and created timestamps cannot be changed through public column grants.
- Per-owner item count is limited to 2,000 under a transaction advisory lock. Ciphertext is limited to 32 KiB per item.
- Client write APIs always use the authenticated account identity. The Node server does not accept a user_id from the browser.

### 4. Data protection

- Existing AES-256-GCM, random nonces, PBKDF2-SHA-256 with 600,000 iterations, random 256-bit salts, and account/record-bound authenticated data remain compatible with version 1.0.
- Master passwords and derived vault keys never go to the backend. Account passwords necessarily go to the sign-in service, and through the Node server when that mode is deployed.
- Plaintext passwords never go into database columns, temporary extension storage, filenames, URL strings, or application logs. Byte buffers are cleared where practical; JavaScript strings cannot be guaranteed erased from physical memory.
- The Supabase publishable key is intentionally public and is not an administrative secret. It cannot bypass RLS.
- Copying still uses the OS clipboard. A user must manage clipboard history separately.

### 5. CSRF

- Static/extension requests omit cookies and attach a bearer token explicitly. They do not rely on ambient browser cookies, so adding a decorative CSRF token would not improve that flow.
- Node mode checks an unpredictable session-bound CSRF token, exact Origin, and Fetch Metadata for every state-changing route, including signup/sign-in/sign-out. SameSite=Strict is additional protection.
- The server sends no permissive CORS headers, rejects unsupported methods/content types/query parameters, and rotates session/CSRF state on authentication.

### 6. Frontend and transport

- CSP disallows inline/eval scripts, external scripts, objects, frames, workers, and base URL changes. Trusted Types is required where supported. Application code uses no unsafe HTML sinks.
- Code and styles are bundled locally. There are no third-party frontend dependencies, fonts, analytics, or remote icon fetches.
- The web app refuses insecure remote HTTP and embedding. HTTP is permitted only for same-computer localhost development.
- The current interface has no external target=_blank links. The static analysis check rejects any future such link missing both noopener and noreferrer.
- Node mode applies HTTP headers. GitHub Pages does not execute Node or use the included Caddy configuration; those protections must not be advertised as enabled there.

## Test evidence

`npm test` passed 21 test cases, each containing multiple assertions:

- Wrong key, modified ciphertext, account/record substitution, canonical envelopes, nonce uniqueness, and non-extractable web keys.
- Unexpected fields, bad types/IDs, unsafe URL schemes, embedded URL credentials, size limits, and invalid revisions.
- Late authentication/refresh after lock, single-flight refresh, credential-free redirects, and error redaction.
- Extension sender/frame/tab/origin restrictions; no cloud writes before trusted approval; encrypted pending data; update/dismiss/expiry/lock behavior.
- Cookie flags, no provider tokens in responses, missing/wrong-origin/stale CSRF rejection, session rotation, protected-route behavior, input rejection, static-file allowlisting, and sign-out.
- Persistent login limits returning HTTP 429, parameterized SQLite queries, encrypted session storage, and survival of rate limits across restarts.
- Shared website/extension asset consistency, DOM references, CSP placement, safe rendering, external-link protection, and extension message boundaries.
- Native/custom/same-document two-step capture, rejection of synthetic/registration/vault events, duplicate-injection protection, and prompts after worker notification.
- Popup permission flow, live pending-list refresh, approval-only saves, manual lock, and extension/server sessions surviving more than five minutes of inactivity.

During the 1.1 audit, `tests/rls.sql` passed against the connected database with disposable data in a rolled-back transaction. It tested owner CRUD, cross-account reads/writes/deletes, owner/timestamp mutation, malformed ciphertext, revision enforcement, MFA downgrade rejection, eight-hour expiry, revoked sessions, and anonymous access. Test records were rolled back. Version 1.2 changes no database rules, and this live SQL test was not rerun for 1.2.

Provider auth and extension APIs were mocked in the local Node tests. The live SQL test exercised real Postgres RLS; it was not a complete browser/Supabase sign-in test. Browser preview remained unavailable, so installed-extension behavior, real email confirmation/TOTP, real TLS cookies, and mobile layout still need the acceptance checks in TESTING.md.

## Outstanding deployment and shared-backend risks

1. **Deploy Node mode to activate cookies and server CSRF/rate limits.** The source package does not mean the server has been deployed. No server secret was generated or placed in this archive.
2. **Review Supabase Auth settings.** Global provider limits/CAPTCHA were not changed because the available connector does not expose those settings and the project is shared. The existing advisor still reports leaked-password protection disabled. Enabling CAPTCHA requires adding a matching client challenge flow first.
3. **Separate the production vault backend.** The project also contains unrelated Boom Chat/football tables and privileged functions. Advisors still report a public executable handle_new_user trigger function, authenticated-executable functions belonging to those applications, and one unrelated table with RLS but no policies. These were not altered as part of the vault update. No new advisor finding named a Pocket Vault object.
4. **Protect deployments.** Use reviewed commits, protected GitHub write access, and patched Node/OS/proxy software. A malicious approved frontend update can read unlocked plaintext despite encryption.
5. **Operate one server process.** Distributed replicas require shared rate limiting and session-refresh coordination. TLS, trusted reverse-proxy headers, persistent disk permissions, backups, provider monitoring, and production load tests remain deployment work.
6. **Limits of encryption.** Account compromise may allow deletion of encrypted records. Offline master-password guessing is still possible after ciphertext theft; use a strong unique passphrase. Device compromise and malicious extensions remain outside the guarantees of this code.

## Source references

- [Supabase authentication rate limits](https://supabase.com/docs/guides/auth/rate-limits): provider limits are distinct from the new server's limits.
- [Supabase session guidance](https://supabase.com/docs/guides/auth/sessions): access-token/session behavior and lifecycle.
- [Supabase server-side authentication guidance](https://supabase.com/docs/guides/auth/server-side/advanced-guide): tokens, cookies, and cache isolation. This package uses its own backend session wrapper, not @supabase/ssr.
- [Chrome extension messaging](https://developer.chrome.com/docs/extensions/develop/concepts/messaging): content-script and extension message boundaries.
- [MDN frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors): this directive cannot be enforced through a meta tag.
- [Node SQLite](https://nodejs.org/api/sqlite.html): built-in database API and prepared statements.
