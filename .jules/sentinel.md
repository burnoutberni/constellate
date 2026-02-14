# Sentinel Journal

## 2025-02-14 - Insecure IP Extraction in Rate Limiting
**Vulnerability:** The rate limiting middleware blindly trusted the first IP in the `X-Forwarded-For` header (`split(',')[0]`). This allowed attackers to bypass rate limits by spoofing the header (e.g., `X-Forwarded-For: spoofed-ip`).
**Learning:** Middleware often defaults to `X-Forwarded-For` without validating the proxy trust chain. When using reverse proxies (like Caddy), `X-Real-IP` is often more reliable, or the *last* IP in `X-Forwarded-For` (the one the proxy observed) should be used if the proxy appends to it.
**Prevention:** Prioritize `X-Real-IP` (if set by trusted proxy) or use the last IP in `X-Forwarded-For`. Avoid using the first IP unless the entire proxy chain is trusted and validated.
