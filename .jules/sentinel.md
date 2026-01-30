## 2024-05-20 - Stored XSS in ActivityPub Federation
**Vulnerability:** Incoming ActivityPub objects (Events, Notes, Persons) were stored in the database without sanitization. While the frontend uses `SafeHTML` to render content, storing raw HTML is a Stored XSS risk if data is consumed by other clients or logged insecurely.
**Learning:** ActivityPub content is inherently untrusted HTML. Relying solely on frontend sanitization is insufficient for a federated protocol where data is shared across many systems.
**Prevention:** Sanitization on ingestion (Defense in Depth) using `isomorphic-dompurify` ensures that stored data is safe for all consumers. Added `sanitizeHtml` to `src/lib/sanitization.ts` and applied it in `src/federation.ts`.
