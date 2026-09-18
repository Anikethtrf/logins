# First-run checks

Use a throwaway website account and test password.

1. Publish on GitHub Pages with HTTPS. Create or sign into your account, then create a unique master password.
2. Add a login. Refresh. Lock and reopen the vault with the master password. Verify the username/password are unchanged.
3. Try a wrong master password. It must fail without showing saved logins.
4. Edit a login and refresh from a second browser. Delete a test login and confirm it disappears after refresh.
5. Install the extension, open its vault, sign in, unlock, enable login detection, and reload the website's login tab.
6. Submit an ordinary HTTPS username/password form. Check the prompt. Click Not now; no entry should appear in the cloud vault.
7. Repeat the login, click Save, then refresh the website vault. Verify the username and password.
8. Save the same website and username with a different test password. It should update the existing entry.
9. Lock the extension and submit the form again. It must not retain or upload the password. Unlock and repeat the login.
10. Wait over 10 minutes without vault interaction. Both website and extension should lock. Restart the browser; the extension should require unlocking again.
11. Sign in as a separate vault account. It must not list the first account's entries.
12. Check the website at phone and desktop widths. Search, editor, and detail actions should remain usable.

If the popup does not appear, check that the extension is unlocked, permission is enabled, and the page has been reloaded after enabling detection. Check the toolbar badge after redirects. Unsupported forms can always be saved manually.
