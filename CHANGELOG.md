# Version 1.2

- Removed the five-minute authenticated idle lock from website, extension, and optional Node server. Manual locking, browser-session cleanup, and the eight-hour absolute deadline remain.
- Fixed detection only attaching to future page loads: enabling capture now also injects into already-open permitted HTTPS tabs. Duplicate injection cannot add duplicate listeners.
- Added capture for common form-less login containers, nested button clicks, Enter, and same-document two-step username/password screens. Capture remains top-frame only; registration and ambiguous multi-password forms are skipped.
- Added a worker-to-page pending notification to recover prompts when a login navigates before the capture reply arrives. Origin/tab checks remain mandatory. Across different-origin redirects, use the toolbar badge to review pending logins.
- Added direct Enable/Pause detection and Refresh controls to the toolbar popup. Pending cards now refresh when new captures arrive while the popup is open. Open vault works directly from the popup.
- Five-minute expiry applies only to unsaved pending captures and pre-authentication handshakes, not the unlocked vault.

The website and extension must still be unlocked separately. Both use the same cloud account. No authentication or key-sharing bridge was added between public websites and the extension.

Automated tests use mocked Chrome/DOM interfaces. Test the updated unpacked extension in your own Brave/Chrome browser with a throwaway login before relying on it. No claim of support for every website or proof that a submitted login succeeded.

Chrome API references: [script injection](https://developer.chrome.com/docs/extensions/reference/api/scripting), [permission requests](https://developer.chrome.com/docs/extensions/reference/api/permissions).
