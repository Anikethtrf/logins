# Pocket Vault

An encrypted cloud password vault and a desktop Chrome / Edge / Brave extension. Built for GitHub Pages with no frontend dependencies and no build required for hosting.

## Publish the website on GitHub

1. Extract the ZIP. Open the `pocket-vault` folder.
2. Create a GitHub repository. Upload the **contents** of this folder so `index.html` is at the repository root.
3. In the repository, go to **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, select your uploaded branch and **/ (root)**, then Save.
5. Open the website address GitHub displays once deployment completes. Keep **Enforce HTTPS** enabled.

The included `config.js` is already connected to your existing Supabase project. The two `pocket_vault_` tables and their access policies have already been installed. Do **not** rerun `database/setup.sql` on this project.

GitHub hosts only the website source. Login records go to Supabase after client-side encryption. The publishable key in `config.js` is intended to be public; never substitute a Supabase service-role or secret key.

### First sign-in

- If you already have an account in this same Supabase project, use that account's email and account password.
- Otherwise select **Create an account**. If email confirmation is enabled, confirm from the email, then return to Pocket Vault and sign in. The shared project's confirmation link may open its previously configured website; return to Pocket Vault after confirmation.
- Create a **separate master password**, at least 14 characters long. This master password is not sent to Supabase.
- Add a test login first, lock the vault, then unlock it to verify everything works.

The connected backend is shared with your other projects, so account registration and account credentials are shared. Vault tables are separate. For an independent public product, configure a dedicated Supabase project before inviting users. This package did not change the project's global authentication settings, existing application tables, or email templates.

## Install the extension

1. Open `chrome://extensions`, `edge://extensions`, or `brave://extensions` on your computer.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose the extracted **extension** folder. Keep the folder on your computer.
4. Pin **Pocket Vault** to the toolbar.
5. Click its icon → **Open & unlock vault**. Sign in with the same account and master password as the website.
6. In that extension vault tab, choose **Browser extension → Enable login detection** and approve access to HTTPS websites. Reload any login tabs already open.
7. Log in on a website using a normal username/password form.
8. The extension asks **“Save this to my website?”**. Confirm that sign-in succeeded, then click **Save login**.
9. Open the website and click **Refresh**. Your saved login appears in the same cloud vault.

If a redirect prevents the in-page prompt, check the extension's toolbar badge and popup for the pending login. The popup also provides Save / Not now. Approval is required before any captured login is uploaded.

Website unlock and extension unlock are separate. The extension must be unlocked before capturing a login; when locked, it discards credentials and asks you to unlock and sign in again. Pending logins expire after five minutes or when their tab closes. The extension locks after ten minutes without vault interaction or a save action, and when the browser restarts.

### Detection limits

- Supports ordinary top-level HTTPS forms containing one password and a username/email field, including many single-page app forms.
- Cannot reliably determine successful authentication on arbitrary sites. It detects a submission attempt, then prompts after navigation/form removal or a short delay. Save only after confirming the sign-in worked.
- Embedded sign-ins, password-only steps, shadow-DOM forms, some custom JavaScript forms, registration/password-change forms, HTTP websites, passkeys, social login tokens, and HTTP basic-auth dialogs are not captured.
- Desktop Chromium browsers only. Mobile Chrome does not support loading this extension. The vault website itself is responsive.
- Does not provide autofill, TOTP, passkey storage, password sharing, or a recovery service.

## Included features

- Supabase email/password account sign-in and registration.
- Separate master-password encryption and local decryption.
- Create, read, edit, search, copy, and delete saved logins.
- 24-character cryptographically generated passwords.
- Extension prompts after supported login submissions and writes only after approval.
- Update an existing login when website origin and username match.
- Revision checks to avoid silently overwriting changes made on another device.
- Automatic locking and temporary password reveal.
- Encrypted backup download. There is no one-click backup import in this version; the backup includes its source account ID because encryption is bound to that ID.

## Security model and limitations

This is a custom prototype, **not an independently audited alternative to Bitwarden**. Test with throwaway accounts before storing real passwords.

- AES-256-GCM uses a fresh random 96-bit IV for each write.
- A random 256-bit salt and PBKDF2-SHA-256 with 600,000 iterations derive the vault key. There is no server-side copy of the master password or plaintext vault key.
- Authenticated additional data binds each encrypted record to its account ID and record ID. Titles, website addresses, usernames, passwords, and notes are inside the encrypted payload.
- Account email, row IDs, timestamps, ciphertext lengths, salt, and an encrypted unlock verifier are visible to the backend. The account password is sent to Supabase Auth over HTTPS for authentication; use a distinct master password.
- Row-level security restricts records to their owner. Anonymous access is denied. Metadata cannot be replaced through the public API.
- Website secrets stay in JavaScript memory and are cleared on lock or page exit. No session tokens, vault keys, or plaintext records are written to browser localStorage or IndexedDB.
- The extension keeps its unlock key and tokens in `chrome.storage.session`, restricted to trusted extension contexts. This is browser-session memory, not a hardware secure enclave. Website content scripts cannot request vault keys, session tokens, or existing vault contents.
- Captured passwords are immediately encrypted in the extension worker before temporary storage. Only the sender's verified HTTPS origin and tab ID are used; credentials are not sent back to page scripts.
- The copy action uses the operating-system clipboard. Clipboard contents are not automatically cleared.
- A compromised device, malicious browser extension, or tampered hosting/source code can read credentials while the vault is unlocked. Protect GitHub write access and review changes before publishing.
- Master-password recovery and master-password rotation are not implemented. Losing the master password loses access to the vault, even if the account password is reset.
- The prototype does not implement MFA enrollment/challenges, breached-password checks, encrypted sharing, audited recovery, or tamper-resistant clients.
- A shared Supabase project's existing database functions/auth configuration have a separate security boundary. No full audit of the other applications was performed.

## Run locally or edit

Use Node 20+ for the test/build commands, or Python 3 to serve the website:

```sh
python -m http.server 4173
```

Open `http://localhost:4173` on the same computer. Do not double-click `index.html`; JavaScript modules and encryption need a web origin. HTTPS is required when hosting publicly.

After changing any shared web file, update the extension copies:

```sh
node build.mjs
```

Then click **Reload** for the extension on the browser's extensions page. The prebuilt extension in this ZIP is already current; Node is not needed just to install it.

### Use your own Supabase project

1. Enable email/password sign-in and run `database/setup.sql` once in the new project's SQL Editor.
2. Replace the public URL/key in `config.js`.
3. Change the allowed API origin in the CSP meta tag in `index.html` and in both `host_permissions` and `content_security_policy` in `extension/manifest.json`.
4. Run `node build.mjs`, publish, and reload the extension.
5. Configure your email confirmation settings and redirect/site URL in Supabase for your deployed website.

Never commit a service-role key, database password, access token, or actual vault backup to your repository.

## Verification

```sh
npm test
```

The tests use Node's built-in runner and Web Crypto, with a mocked extension runtime/API. No installation is needed. Tests cover encryption round trips, wrong passwords, ciphertext tampering, account/record binding, random IVs, key import, password generation, extension message authorization, no cloud write before consent, encrypted pending data, save/update/dismiss, expiry, and locking.

`tests/rls.sql` checks the database's real ownership policies, own-record CRUD, cross-account reads/writes, owner reassignment, stale revisions, and anonymous access. It creates disposable records inside a transaction and rolls them all back. This test passed on the connected project.

The browser preview was unavailable in the build environment. Real installed-extension flows and full sign-in/email-confirmation flows have **not** been verified end to end. Follow `TESTING.md` with throwaway credentials before regular use.

## Design references

Implementation uses the platform APIs documented by [Chrome extension storage](https://developer.chrome.com/docs/extensions/reference/api/storage), [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), and [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
