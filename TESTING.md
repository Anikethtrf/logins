# Acceptance checks for version 1.2

Use throwaway credentials first. The automated tests and real-database RLS checks have passed; these browser/deployment checks remain to be performed.

1. Replace all old web assets and reload the extension. Create/sign in to an account and verify email confirmation if required.
2. Create a vault, save a test login, refresh, lock, sign in again, and unlock. Check the exact saved password, including special characters.
3. Try a wrong master password several times. Confirm that cooldowns appear and no data is shown.
4. Test an account with an existing TOTP factor. Data must remain inaccessible before a valid code. An unsupported factor must not be bypassed.
5. Create a second account and verify that the first account's entries cannot be listed, updated, or deleted by changing API IDs.
6. Install/unlock the extension and enable detection. Submit a supported HTTPS login. Clicking Review & save should open an extension-owned page. Clicking Not now must not write any cloud data. Clicking Save in the extension should save or update the expected login.
7. Lock the vault while a network request is slow. It must stay locked when the response completes. Leave the authenticated website, extension, and server session idle for over five minutes: they must remain unlocked. Manual lock must still clear state; the eight-hour absolute deadline must still expire the session.
8. Restart the browser. The extension must require a new sign-in and unlock. Reloading the website must never retain its decryption key.
9. In Node mode, inspect cookies: __Host-pocket_session, HttpOnly, Secure, SameSite=Strict, Path=/. Responses must not contain Supabase tokens.
10. Test Node-mode POSTs with missing/stale CSRF headers and a different Origin: expect 403. A sixth sign-in attempt for the same email within 15 minutes should return 429. Use a test account to avoid temporarily blocking your own access.
11. Confirm HTTPS, CSP, frame-ancestors, HSTS, no-store, nosniff, and X-Frame-Options at the actual public URL. Verify the proxy overwrites client-IP forwarding headers and the Node port is not directly public.
12. Verify the website at phone and desktop sizes, including the editor, search, MFA input, and extension review screen.

Run `npm test` with Node 24.19.x or a newer Node 24 security release. `tests/rls.sql` is intended for a database-owner SQL session and rolls back its disposable fixtures. Never run stress/brute-force checks against real user accounts or unrelated applications.
