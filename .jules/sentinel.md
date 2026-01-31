## 2025-01-31 - Stored XSS in Federation Handlers
**Vulnerability:** Incoming ActivityPub content (Events, Notes, Profiles) was stored directly in the database without sanitization.
**Learning:** The codebase assumed frontend sanitization (via `SafeHTML`) was sufficient, violating defense-in-depth principles. Backend services must sanitize untrusted input from federation.
**Prevention:** Added `sanitizeHtml` and `sanitizeText` using `isomorphic-dompurify` in `src/federation.ts` before database storage.
