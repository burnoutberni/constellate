## 2024-05-22 - Stored XSS via ActivityPub Federation
**Vulnerability:** Federated content (ActivityPub events, notes, profiles) often contains HTML. Backend ingestion (`src/federation.ts`) was extracting these fields directly without sanitization, leading to a Stored XSS vulnerability if the frontend or other consumers rendered this data unsafely.
**Learning:** Backend ingestion must sanitize user-generated content before storage (defense in depth), even if the frontend has its own sanitization. Trusting the frontend is insufficient as other clients (mobile, API) might not be as secure.
**Prevention:** Use `isomorphic-dompurify` at the ingress point (`src/federation.ts`) to sanitize HTML content using a strict whitelist, mirroring the frontend's security policy.
