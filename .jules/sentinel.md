## 2026-01-16 - Stored XSS in Federation Handlers
**Vulnerability:** Incoming ActivityPub data (events, comments, profiles) was stored directly in the database without sanitization. This allowed remote instances to inject malicious scripts (Stored XSS) via fields like `name`, `summary`, `content`, and `location`.
**Learning:** Federation endpoints often trust remote data too much. While we sanitized API inputs from our own frontend, we missed sanitizing data from other servers.
**Prevention:** Always sanitize data at the boundary, regardless of the source (API or Federation). Added `sanitizeText` to all federation handlers before database upserts.
