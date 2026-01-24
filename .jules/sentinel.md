## 2025-02-09 - Federation XSS Sanitization
**Vulnerability:** Incoming ActivityPub content (events, comments) was not sanitized before storage, allowing Stored XSS if the frontend rendered it without further sanitization. While the frontend uses `SafeHTML`, backend-side sanitization is critical for defense-in-depth and preventing malicious data from entering the system.
**Learning:** Federation handlers receive raw HTML from untrusted external sources. Always sanitize HTML at the boundary (ingestion) using a strict whitelist policy matching the frontend's rendering capabilities.
**Prevention:** Use `sanitizeHtml` from `src/lib/sanitization.ts` for all rich text fields (content, summary) in ActivityPub handlers (`src/federation.ts`).
