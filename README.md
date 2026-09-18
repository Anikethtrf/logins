# Pocket Vault 1.1 — security hardening update

An encrypted cloud vault, desktop Chromium extension, and optional server mode. Source code can be published on GitHub. Your connected Supabase vault tables have already received the 1.1 hardening update.

## Update an existing installation

1. Replace the old website files with this package's files. Do not mix 1.0 and 1.1 JavaScript files.
2. Replace the installed extension's folder contents and click **Reload** on your browser's extensions page. Alternatively, load the supplied standalone extension ZIP after extracting it.
3. Sign in and unlock again. Existing encrypted vault records keep the same format and master password.
4. Test using a throwaway login first. Review `SECURITY-AUDIT.md` for findings, checks, and deployment limits.

Do not rerun `database/setup.sql` or `database/hardening.sql` on the already-configured project. Both changes have been applied. No existing application data was deleted.

## Choose the website's hosting mode

| Capability | GitHub Pages | Included Node server |
|---|---|---|
| Encrypted vault, search, edit, copy, delete | Yes | Yes |
| Owner-only RLS and live-session checks | Yes | Yes |
| Five-minute local vault lock / eight-hour DB session limit | Yes | Yes |
| Strict CSP meta tag | Yes | Yes, plus HTTP CSP headers |
| Authentication state | Bearer tokens in JS memory only | HttpOnly, Secure, SameSite=Strict opaque cookie |
| CSRF protection | Cookie-free API calls with explicit bearer tokens | Synchronizer token, Origin, Fetch Metadata, SameSite |
| App-level server login limits | No; depends on Supabase | Persistent IP and email limits, plus Supabase |
| Server-enforced five-minute app session timeout | No | Yes |
| Header-based anti-framing / application HSTS | Controlled by hosting provider | Included |

For the full cookie/CSRF/server-rate-limit protections requested in this audit, deploy the **Node server mode**, following `server/README.md`. Uploading server files to GitHub Pages does not enable those protections.

## Publish the static version on GitHub Pages

1. Extract the project ZIP and upload the contents of `pocket-vault` so `index.html` is at the repository root.
2. In **Settings → Pages**, choose **Deploy from a branch**, your branch, and **/ (root)**.
3. Open the HTTPS address GitHub displays after deployment. Keep **Enforce HTTPS** enabled.

The `config.js` publishable Supabase key is public configuration, not a secret. Never replace it with a service-role/secret key. Do not upload `.vault-data`, environment files, or vault backups. The package contains no actual account credentials, master password, session tokens, or server secret.

## Sign in and create the vault

Use your existing account in the connected Supabase project, or select **Create an account**. Confirm your email when required, return here, and sign in. Because this backend is shared with your other apps, the confirmation link may still open its existing configured website.

Choose a separate master passphrase of at least 14 characters. It encrypts and decrypts your logins locally and is never sent to Supabase or the Node server. Forgotten master passwords cannot be recovered. Master-password rotation and one-click backup restore are not implemented.

Verified MFA factors are enforced by the database. This app supports entering an already-enrolled TOTP authenticator code; it does not enroll new factors. Phone/WebAuthn factors are not supported by its sign-in screen. A required factor will not be silently bypassed.

## Install the extension

1. Extract the `extension` folder, or extract `Pocket-Vault-Extension.zip`.
2. Open `chrome://extensions`, `edge://extensions`, or `brave://extensions` on desktop.
3. Enable **Developer mode → Load unpacked** and select the folder containing `manifest.json`.
4. Pin Pocket Vault, open it, and click **Open & unlock vault**.
5. Sign in with the same account and master password as the website.
6. In the extension vault tab, choose **Browser extension → Enable login detection**, approve the requested HTTPS website access, and reload any existing login tabs.
7. Submit a supported username/password login. The banner asks **“Save this to my website?”**.
8. Click **Review & save**. Check the website/account in the extension's own screen, then click **Save login**.
9. Refresh your website vault to see the encrypted cloud record.

The extra review keeps final approval out of a website's editable page. The page cannot send a SAVE command to the worker. You can also approve or dismiss pending logins from the toolbar popup.

The extension and website unlock separately. Captured passwords are encrypted in the extension before temporary storage and uploaded only after approval. Pending logins expire after five minutes or when their source tab closes; at most 20 are kept. Locking clears them. The extension unlock state is restricted to trusted extension contexts and lives only in browser-session memory.

### Detection limits

Ordinary top-level HTTPS forms with a username/email and one password are supported. Some custom forms, two-step password-only flows, shadow-DOM/embedded forms, registration/password-change forms, HTTP sites, passkeys, social sign-ins, and basic-auth dialogs are not captured. The extension detects an attempted submission and cannot reliably verify success on every website. Save only after checking that sign-in succeeded.

Desktop Chromium browsers only. Mobile Chrome cannot load this extension; the vault website is responsive. No autofill, passkey storage, TOTP storage, or password sharing is included.

## Local development

For a static local preview, run Python 3 from the project folder:

```sh
python -m http.server 4173 --bind 127.0.0.1
```

Open `http://localhost:4173` on that computer. Do not double-click `index.html`. Public deployments require HTTPS.

Use Node.js 24.19.x or a newer Node 24 security release for server mode and tests. There are no external npm dependencies:

```sh
npm test
node build.mjs
```

`build.mjs` refreshes shared website files inside `extension`. Run it after edits, then reload the extension. The provided files are already built.

## New independent Supabase project

For a separate public product, use a dedicated project instead of the shared backend:

1. Enable email/password sign-in and email confirmation.
2. Run `database/setup.sql` once, then `database/hardening.sql`.
3. Set the public URL/key in `config.js`.
4. Update the API origin in `index.html` and `extension/manifest.json`.
5. Run `node build.mjs` and test.
6. Configure the actual website URL, confirmation/redirect settings, provider-side rate limits, and monitoring in Supabase.

Do not change the project's global CAPTCHA/MFA settings without updating and testing every client that shares it. CAPTCHA integration is not implemented in this package.

## Security limits

This is a reviewed and hardened custom application, not an independently certified password manager. A compromised device, malicious extension, stolen server secret, or maliciously modified website can still undermine security. HttpOnly cookies do not prevent an XSS payload from taking actions through the browser; CSP and safe DOM handling remain necessary.

The master password protects vault contents, not account availability: someone who compromises the account can delete that account's ciphertext. Use MFA where supported and keep encrypted backups outside your public repository.

The account email, IDs, timestamps, salt, and ciphertext lengths remain visible to the service. Copying a password puts it in the OS clipboard; it is not automatically cleared. JavaScript cannot guarantee complete erasure of every old string from physical memory.

See `SECURITY-AUDIT.md` and `TESTING.md` for scope and validation evidence.
