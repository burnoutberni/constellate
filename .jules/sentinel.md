## 2024-05-24 - Stored XSS in ActivityPub Federation
**Vulnerability:** Incoming ActivityPub objects (Events, Notes, Profiles) were stored directly in the database without sanitization, allowing remote instances to inject XSS payloads via `summary`, `content`, and `bio` fields.
**Learning:** Federated applications must treat remote data as untrusted user input, even if it comes from "server-to-server" communication. Local input validation (Zod) is insufficient if the ingress path for federation bypasses it.
**Prevention:** Apply strict HTML sanitization (e.g., `isomorphic-dompurify`) on all text/HTML fields at the ingress point (`src/federation.ts`) before database storage.
