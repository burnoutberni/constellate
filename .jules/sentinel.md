## 2024-05-24 - Rate Limit Scope Collision
**Vulnerability:** Different rate limiters (strict/moderate/lenient) shared the same in-memory store and key generation logic (IP/User ID). This meant that usage on a lenient endpoint (e.g., public feed) consumed the quota for strict endpoints (e.g., login), potentially leading to DoS for legitimate users.
**Learning:** In-memory rate limiting requires careful key namespace management. When using a shared store (like a generic Map or Redis instance), keys must include the context or scope of the limit to prevent collisions.
**Prevention:** Always include a unique scope identifier in rate limit keys when multiple limiters share the same storage backend.
