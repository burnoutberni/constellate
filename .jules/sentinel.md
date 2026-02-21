## 2025-02-23 - Secure IP Extraction from X-Forwarded-For
**Vulnerability:** Rate limiting bypass was possible because the application extracted the *first* IP from the `X-Forwarded-For` header. Attackers could spoof this by sending a header like `X-Forwarded-For: spoofed-ip`.
**Learning:** In standard reverse proxy configurations (like Caddy default), the proxy *appends* the connecting client's IP to the list. Thus, `X-Forwarded-For` becomes `spoofed-ip, real-ip`. The application must trust the *last* IP in the list (the one added by the trusted proxy).
**Prevention:** Always extract the **last** IP from `X-Forwarded-For` when behind a trusted proxy that appends IPs. This works securely even if the proxy is configured to replace the header (list length 1).
