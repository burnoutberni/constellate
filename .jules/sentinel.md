# Sentinel's Journal

## 2024-05-22 - Rate Limiting IP Spoofing via X-Forwarded-For

**Vulnerability:** The rate limiting middleware blindly trusted the first IP in the `X-Forwarded-For` header. An attacker could spoof this header (e.g., `X-Forwarded-For: fake-ip`) to bypass rate limits, as the trusted proxy (Caddy) would append the real IP to the end of the list (`fake-ip, real-ip`), and the application would use `fake-ip`.

**Learning:** When an application is behind a trusted proxy that *appends* to `X-Forwarded-For`, the header is a list where the *first* entry is potentially user-controlled and untrusted. The only trusted IP is the one added by the proxy itself, which is typically the *last* one in the list (or counting backwards based on the number of trusted proxies).

**Prevention:** Always prioritize the *last* IP in the `X-Forwarded-For` list when determining the client IP for security controls like rate limiting. Alternatively, configure the trusted proxy to overwrite the `X-Forwarded-For` header completely (e.g., `header_up X-Forwarded-For {remote_host}` in Caddy), but application-level defense is safer.
