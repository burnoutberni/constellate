## 2025-01-27 - [CRITICAL] Rate Limit IP Extraction Vulnerability
**Vulnerability:** Rate limiting middleware prioritized the *first* IP in `X-Forwarded-For` header. Attackers could spoof this header (`X-Forwarded-For: spoofed_ip`) to bypass rate limits because the trusted proxy (Caddy) appended the real IP to the end, resulting in `spoofed_ip, real_ip`.
**Learning:** Relying on the first IP in `X-Forwarded-For` is dangerous when behind a proxy that appends IPs. Caddy (and most proxies) append to this header.
**Prevention:** Always prioritize `X-Real-IP` (if set by trusted proxy) or use the *last* IP in `X-Forwarded-For` chain, which represents the IP added by the immediate trusted proxy.
