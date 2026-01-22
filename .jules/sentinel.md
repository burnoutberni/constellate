## 2026-01-22 - Stored XSS in ActivityPub Federation
**Vulnerability:** Incoming ActivityPub objects (Events, Notes, Profiles) were being stored in the database without sanitization. Specifically, fields like `summary` and `content` could contain malicious scripts that would be served to clients.
**Learning:** Federated data sources must be treated as untrusted user input. Backend sanitization is crucial for defense-in-depth, especially when data might be consumed by diverse clients.
**Prevention:** Always sanitize rich text fields (using `sanitizeHtml`) and plain text fields (using `sanitizeText`) at the ingestion layer (in `src/federation.ts` handlers) before persistence.
