## 2024-05-22 - ActivityPub Input Sanitization
**Vulnerability:** Missing sanitization of incoming ActivityPub text fields (names, summaries, content) in `src/federation.ts` and `src/lib/activitypubHelpers.ts`, leading to Stored XSS risks.
**Learning:** Even if helper libraries exist (`sanitizeText` in `src/lib/sanitization.ts`), they must be explicitly applied at all data entry points. The assumption that data was sanitized was incorrect.
**Prevention:** Always verify that input from external sources (especially federated content) is passed through sanitization functions before database storage. Add tests or lint rules to enforce this if possible.
