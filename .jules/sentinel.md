## 2025-01-13 - Stored XSS in ActivityPub Federation
**Vulnerability:** Incoming ActivityPub data (events, notes, profiles) was not sanitized before being stored in the database. This allowed malicious instances to inject HTML/JS payloads (Stored XSS) into the application.
**Learning:** ActivityPub content `content`, `summary`, `name` is untrusted input and must be sanitized before storage. ORMs protect against SQLi but not Stored XSS.
**Prevention:** Applied `sanitizeText` (stripping all HTML) to all incoming ActivityPub text fields in `src/federation.ts` and `src/lib/activitypubHelpers.ts`. Added regression test `src/tests/federation.security.test.ts`.
