# Sentinel Journal

This journal records CRITICAL security learnings, vulnerabilities, and patterns discovered by Sentinel.

## 2024-05-22 - ActivityPub Stored XSS
**Vulnerability:** Incoming ActivityPub content (events, comments, profiles) was stored in the database without sanitization, relying solely on frontend output encoding. This created a Stored XSS risk if any consumer rendered the data raw.
**Learning:** Federated data sources are untrusted user input and must be sanitized before storage or consumption, implementing Defense in Depth.
**Prevention:** Added input sanitization layer (`sanitizeRichText`) for all incoming ActivityPub content before persisting to the database.
