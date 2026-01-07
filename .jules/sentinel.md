## 2024-05-23 - Rate Limit Store Isolation
**Vulnerability:** The rate limit middleware used a global `rateLimitStore` (Map), causing all rate limiters (strict, moderate, lenient) to share the same counters for a user/IP. This meant requests to public endpoints consumed quota for sensitive endpoints, potentially leading to denial of service on sensitive actions.
**Learning:** Factory functions that return middleware should typically encapsulate their state (like counters) within the factory closure, rather than using a module-level global variable, unless the state is explicitly intended to be shared.
**Prevention:** When implementing middleware factories, verify the scope of any state variables. Use closure scope for instance-specific state.
