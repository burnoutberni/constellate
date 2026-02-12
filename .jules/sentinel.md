## 2026-02-12 - Inconsistent Input Sanitization for Federated Content
**Vulnerability:** Federated content (ActivityPub events and notes) was stored in the database without sanitization, while local user content was sanitized. This allowed federated instances to inject arbitrary HTML (Stored XSS) or bypass content restrictions.
**Learning:** Security controls applied to local users (e.g., input sanitization in API endpoints) must also be applied to data ingested from external sources (federation). Trust boundaries are critical.
**Prevention:** Ensure that all ingress points (API, Federation, Webhooks) pass data through the same validation and sanitization logic. Used `sanitizeText` (DOMPurify) on federated content before storage.
