
## 2025-12-22 - Shared Rate Limit Store Collision
**Vulnerability:** Rate limiters with different policies (strict, lenient) shared the same in-memory store and key generation logic (IP/User ID). Usage of a lenient endpoint consumed the quota of strict endpoints, leading to potential DoS of critical functions.
**Learning:** In-memory rate limiting must namespace keys by the policy/scope to prevent cross-policy interference.
**Prevention:** Always include a unique scope or namespace in rate limit keys when using a shared storage backend.
