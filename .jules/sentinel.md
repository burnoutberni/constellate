## 2026-01-27 - Missing Sanitization in ActivityPub Ingestion
**Vulnerability:** Incoming ActivityPub data (events, comments, profiles) was stored raw in the database without HTML sanitization, leading to Stored XSS risks if other clients rendered it unsafely.
**Learning:** The application relied entirely on frontend sanitization (`SafeHTML`), violating the defense-in-depth principle. Federated protocols often carry rich text, making them a high-risk vector for XSS.
**Prevention:** Always sanitize rich text inputs at the API/Service boundary using a strict allowlist (like DOMPurify) before storage, ensuring the backend is the source of truth for safe content.
