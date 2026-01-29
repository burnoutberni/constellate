## 2026-01-29 - Input Sanitization for ActivityPub Content
**Vulnerability:** Unsanitized ActivityPub content (Events, Comments, Profiles) allowing Stored XSS.
**Learning:** ActivityPub content is inherently untrusted and often contains HTML. While frontend components like `SafeHTML` provide defense, relying solely on them is insufficient. Backend storage should ensure content is sanitized to prevent malicious scripts from persisting in the database, protecting current and future clients (defense in depth).
**Prevention:** Always sanitize rich text inputs from external sources using a strict allowlist (e.g., `DOMPurify`) at the entry point (federation handlers) before storage. Use `sanitizeText` for plain text fields and `sanitizeHtml` for rich text fields.
