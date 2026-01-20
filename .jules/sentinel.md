## 2026-01-20 - Stored XSS in ActivityPub Ingestion

**Vulnerability:** Incoming ActivityPub objects (Events, Notes) were being stored directly in the database without sanitization. An attacker could send a malicious `content` or `summary` payload (e.g., `<script>`) which would be executed when local users viewed the federated content.
**Learning:** Federated protocols like ActivityPub trust the transport layer but should NOT trust the content payload. Just because a message is signed doesn't mean the HTML inside it is safe to render.
**Prevention:** Sanitization must happen at the boundary (ingestion time). Added `sanitizeHtml` using `isomorphic-dompurify` to strip dangerous tags while preserving safe formatting for `summary` and `content`.
