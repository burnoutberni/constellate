# Sentinel's Journal

## 2025-02-18 - IP Spoofing via X-Forwarded-For Header
**Vulnerability:** The rate limiting middleware was extracting the client IP address by taking the *first* IP in the `X-Forwarded-For` header (`split(',')[0]`). This allowed attackers to bypass rate limits by spoofing the header (e.g., sending `X-Forwarded-For: <fake-ip>`), as the trusted proxy (Caddy) would append the real IP to the end of the list, resulting in `<fake-ip>, <real-ip>`.
**Learning:** Even when using a trusted proxy like Caddy which is configured to set headers, application code must still be robust against potential upstream configurations or misconfigurations where headers are appended rather than replaced. The standard security practice when behind a proxy that appends IPs is to trust the *last* IP in the list.
**Prevention:** Always use the rightmost IP in the `X-Forwarded-For` list when the application is behind a proxy that appends the client IP. Validate and sanitize header inputs. Use dedicated libraries or robust logic for IP extraction rather than naive string splitting.
