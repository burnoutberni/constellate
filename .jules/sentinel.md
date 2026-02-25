## 2026-02-25 - Rate Limit IP Spoofing
**Vulnerability:** The rate limiter was using the first IP in `X-Forwarded-For`, allowing attackers to spoof their IP by sending a custom header which would be prepended to the real IP by the proxy.
**Learning:** When behind a trusted proxy (like Caddy), the `X-Forwarded-For` header contains a list of IPs. The *last* added IP is the most trustworthy one if we trust the proxy chain. The client-provided header is at the beginning.
**Prevention:** Always use the last IP in `X-Forwarded-For` when behind a trusted proxy, or use a library that handles this trust chain correctly.
