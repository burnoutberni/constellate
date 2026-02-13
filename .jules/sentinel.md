# Sentinel's Journal 🛡️

## 2025-02-18 - [IP Spoofing in Rate Limiting]
**Vulnerability:** The rate limiting middleware was determining the client IP by taking the *first* address in the `X-Forwarded-For` header (`split(',')[0]`). In many proxy configurations (standard appending behavior), the client controls the beginning of the header, allowing them to spoof their IP and bypass rate limits.
**Learning:** Relying on `X-Forwarded-For` without validating the trusted proxy chain is dangerous. In a containerized environment with a known reverse proxy (like Caddy), we should prioritize `X-Real-IP` (if set by the proxy) or use the *last* IP in `X-Forwarded-For` (which represents the connection to our proxy).
**Prevention:** Always use the *last* trusted IP in `X-Forwarded-For`, or prefer `X-Real-IP` if the infrastructure guarantees its authenticity. Avoid `split(',')[0]` on `X-Forwarded-For`.
