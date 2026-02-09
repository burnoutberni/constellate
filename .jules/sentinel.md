## 2024-05-22 - Stored XSS via ActivityPub
**Vulnerability:** ActivityPub content (summary, content) was stored unsanitized in the database.
**Learning:** Federation logic acts as a second ingress point for user content and must be sanitized just like API endpoints. `sanitizeText` was too aggressive for this use case as it strips all HTML.
**Prevention:** Ensure all ingress points (API, Federation, etc.) sanitize HTML content if the system supports rich text. Use `DOMPurify` with a strict allowlist.
