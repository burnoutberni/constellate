# Sentinel's Journal

## 2025-12-21 - Rate Limit Bucket Collision

**Vulnerability:** Shared in-memory rate limit store caused strict limiters to block valid traffic from lenient limiters if they shared the same key (IP/User).
**Learning:** When using shared storage for multiple rate limiters, always namespace the keys by the limiter instance or purpose.
**Prevention:** Added `scope` parameter to `RateLimitConfig` and auto-generated namespaces for new limiters.
