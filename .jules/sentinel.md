## 2026-01-04 - Stored XSS in ActivityPub Federation
**Vulnerability:** Incoming ActivityPub data (events, comments, profiles) was persisted to the database without sanitization, allowing Stored XSS attacks from federated instances.
**Learning:** Federated data sources are untrusted external inputs and must be treated with the same suspicion as direct user input. ActivityPub's JSON-LD structure can mask where malicious strings might hide (e.g., deeply nested objects).
**Prevention:** Explicitly sanitize all string fields extracted from ActivityPub objects at the ingestion point (`src/federation.ts`) using `sanitizeText` before database operations. Added `src/tests/federation.security.test.ts` to enforce this pattern.
