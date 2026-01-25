## 2024-03-24 - Rate Limiting IP Spoofing
**Vulnerability:** The rate limiting middleware blindly trusted the *first* IP in the `X-Forwarded-For` header (`split(',')[0]`). This allows attackers to bypass rate limits by sending a header like `X-Forwarded-For: fake-ip`, as the trusted proxy (Caddy) appends the real IP to the end of the list.
**Learning:** In a single trusted proxy setup (like Caddy -> Node), the *last* IP in `X-Forwarded-For` is the only one guaranteed to be added by the trusted proxy. The first IP is user-controlled if the user manually sets the header.
**Prevention:** Always use the last IP in `X-Forwarded-For` when behind a single trusted reverse proxy. Use `split(',').pop()`.
