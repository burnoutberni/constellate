# Sentinel's Journal

## 2025-02-17 - Shared Rate Limit Buckets
**Vulnerability:** Rate limit buckets were shared across different rate limiters using the same key (e.g., `user:ID`).
**Learning:** This caused interference where heavy usage of "moderate" endpoints could trigger "strict" limits, effectively locking the user out of sensitive actions.
**Prevention:** Rate limit keys must be scoped to the specific limiter configuration (e.g., `strict:user:ID` vs `moderate:user:ID`).
