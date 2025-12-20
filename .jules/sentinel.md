# Sentinel's Journal

## 2025-05-18 - Rate Limit Buckets Collision
**Vulnerability:** Different rate limiters (strict, moderate, lenient) shared the same underlying storage key (IP or User ID), causing requests to low-sensitivity endpoints to consume the quota of high-sensitivity endpoints (DoS risk).
**Learning:** Default key generation strategies that rely solely on IP/User ID are insufficient when multiple rate limit policies are in effect for the same user/IP.
**Prevention:** Always namespace rate limit keys by the policy or "scope" they belong to.
