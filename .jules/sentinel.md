## 2026-02-01 - ActivityPub Ingress Sanitization Gap
**Vulnerability:** Incoming ActivityPub data (events, comments, profiles) was stored raw in the database, creating a Stored XSS risk if consumed by clients without strict output sanitization (defense-in-depth gap).
**Learning:** The application relied solely on frontend `SafeHTML` for sanitization. While effective for the web client, this leaves the database tainted and risks other clients (mobile, API consumers) rendering malicious content.
**Prevention:** Always sanitize user input at the ingress point (Federation handlers) before storage, using a shared configuration with the frontend to ensure consistency.
