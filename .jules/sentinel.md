## 2024-05-23 - Federation Input Sanitization
**Vulnerability:** Incoming ActivityPub data (events, profiles, comments) was stored directly in the database without sanitization, leading to potential Stored XSS if rendered unsafely.
**Learning:** Backend must independently sanitize rich text content (HTML) using the same whitelist as the frontend to ensure Defense in Depth.
**Prevention:** Use `sanitizeHtml` from `src/lib/sanitization.ts` for all incoming rich text and `sanitizeText` for plain text fields.
