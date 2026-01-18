## 2026-01-18 - Stored XSS in ActivityPub Federation
**Vulnerability:** Incoming ActivityPub content (Events, Profiles) was stored raw in the database without sanitization. While the frontend used `SafeHTML`, storing malicious HTML is a risk for other API consumers and "Defense in Depth".
**Learning:** The application assumed that since the frontend sanitized content, the backend didn't need to. This is a common fallacy in federated systems where the backend acts as a relay.
**Prevention:** Implemented `sanitizeHtml` in the backend ingestion layer (`src/federation.ts`) using the same whitelist config as the frontend to ensure consistency and safety at the storage level.
