## 2026-02-10 - ActivityPub XSS Vulnerability
**Vulnerability:** Incoming ActivityPub content (events, notes) was stored directly in the database without sanitization, leading to Stored XSS.
**Learning:** The federation handler `src/federation.ts` extracted properties from external JSON-LD objects but lacked a sanitization step before persistence. The assumption that "extraction" implies "safety" was incorrect.
**Prevention:** Always sanitize user-generated content at the ingress point (API or Federation handler) using a library like DOMPurify before storing it, especially when dealing with rich text formats like HTML.
