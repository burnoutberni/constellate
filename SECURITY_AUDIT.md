# Security Audit & Refactoring Proposals
## Stellar Calendar - ActivityPub Federated Calendar Platform

**Date:** 2025-11-26
**Scope:** Full codebase security review, code quality assessment, and maintainability analysis

---

## Executive Summary

This audit identifies **critical security vulnerabilities**, **moderate security concerns**, and **code quality improvements** across the codebase. The application implements ActivityPub federation with HTTP signatures, SSRF protection, and user authentication.

**Update (2025-11-26):** We have verified the following fixes and identified remaining issues:

**Verified Fixed:**
- ✅ Authentication inconsistencies fixed - `requireAuth(c)` is consistently used in sensitive endpoints.
- ✅ Signature verification bug fixed - Logic is correct, though replay protection is missing.
- ✅ Private keys encrypted at rest - AES-256-GCM encryption is correctly implemented.
- ✅ Environment validation implemented - Config is centralized.
- ✅ Prisma client singleton implemented - Connection management is improved.
- ✅ Authorization helpers implemented - `requireOwnership` and `requireAdmin` are available.
- ✅ Admin role support added.
- ✅ Structured error handling implemented.
- ✅ Security headers middleware implemented.
- ✅ Request timeouts added to external fetches.
- ✅ CORS configuration made environment-variable based.

**Remaining Priority Issues:**
- 🟠 **HIGH** - SSRF Protection is weak (Regex-based, no DNS resolution, no redirect handling).
- 🟠 **HIGH** - No CSRF Protection for state-changing operations.
- 🟡 **MEDIUM** - Rate limiting middleware exists but is **NOT APPLIED** to public endpoints (`search.ts`, `userSearch.ts`).
- 🟡 **MEDIUM** - SSE (`realtime.ts`) allows anonymous connections.
- 🟡 **MEDIUM** - Input sanitization is missing in backend (relies on frontend escaping).
- 🟡 **MEDIUM** - Activity IDs use `Date.now()` (collision risk).
- 🟡 **MEDIUM** - HTTP Signature Replay Attack protection is missing.

**Priority Levels:**
- 🔴 **CRITICAL** - Immediate action required
- 🟠 **HIGH** - Address soon
- 🟡 **MEDIUM** - Should be addressed
- 🟢 **LOW** - Nice to have

---

## 1. Authentication & Authorization Issues

### ✅ FIXED: Inconsistent Authentication Mechanisms

**Status:** Verified. All endpoints in `likes.ts`, `attendance.ts`, `events.ts`, `profile.ts`, `moderation.ts`, `comments.ts` use `requireAuth(c)`.

---

### ✅ FIXED: Missing Authorization Helpers

**Status:** Verified. `requireOwnership` and `requireAdmin` exist in `src/middleware/auth.ts` and are used.

---

### 🟡 MEDIUM: Session Management

**Issue:** No explicit session expiration or refresh token rotation visible.

**Proposal:**
- Review better-auth session configuration
- Ensure proper session cleanup
- Add session invalidation on password change

---

## 2. Input Validation & Sanitization

### 🔴 CRITICAL: SQL Injection Risk (Low, but present)

**Issue:** While Prisma provides parameterized queries, there are string concatenations in URL parsing that could be risky if extended.

**Location:**
- `src/activitypub.ts`: Lines 115, 161, 187 - URL parsing with `.split('/').pop()`
- `src/federation.ts`: Multiple instances of URL parsing
- `src/userSearch.ts`: Complex URL parsing logic

**Risk:** If URL parsing logic is extended to build queries, could introduce injection.

**Proposal:**
1. **Centralize URL parsing** with validation
2. **Use URL parsing utilities** that validate format
3. **Add input sanitization** for all user-provided strings

**Refactor:**
```typescript
// Create URL parsing utility with validation
export function parseActorUrl(url: string, baseUrl: string): {
    username: string;
    isLocal: boolean;
} | null {
    try {
        const parsed = new URL(url)
        if (!parsed.pathname.startsWith('/users/')) {
            return null
        }
        const username = parsed.pathname.split('/users/')[1]?.split('/')[0]
        if (!username || !/^[a-zA-Z0-9_-]+$/.test(username)) {
            return null
        }
        return {
            username,
            isLocal: parsed.origin === new URL(baseUrl).origin
        }
    } catch {
        return null
    }
}
```

---

### 🟠 HIGH: Missing Input Length Limits

**Issue:** Some endpoints lack proper length validation:

1. **Comments** (`src/comments.ts`): Max 5000 chars - reasonable
2. **Event Title** (`src/events.ts`): Max 200 chars - reasonable
3. **Bio** (`src/profile.ts`): Max 500 chars - reasonable
4. **Search Query** (`src/userSearch.ts`): No explicit limit

**Proposal:**
- Add explicit length limits to all text inputs
- Add rate limiting for search endpoints
- Validate URL formats strictly

---

### 🟡 MEDIUM: XSS Risk in User-Generated Content

**Issue:** User-provided content (bio, comments, event descriptions) is stored and displayed without explicit sanitization.
**Verification:** Frontend (React) escapes content by default, reducing immediate risk. However, storing raw HTML is bad practice and risky for other clients.

**Location:**
- All user input fields
- ActivityPub content from remote instances

**Proposal:**
1. **Sanitize HTML** in user inputs (if HTML is allowed)
2. **Escape content** when rendering (client-side)
3. **Content Security Policy** headers
4. **Validate ActivityPub content** from remote instances

---

## 3. HTTP Signature Verification

### ✅ FIXED: Signature Verification Bug

**Status:** Verified. Variable name bug is fixed.

---

### 🟠 HIGH: Signature Verification Improvements Needed

**Issue:** While the critical bug is fixed, signature verification could be improved:

1. **Host header manipulation** (`src/activitypub.ts`): Logic overrides Host header with target host.
2. **Missing header validation**: Doesn't verify all required headers are present before verification
3. **No signature replay attack protection**: Missing timestamp validation (Confirmed).

**Location:**
- `src/activitypub.ts`: Personal inbox & Shared inbox
- `src/lib/httpSignature.ts`

**Proposal:**
1. **Improve host header handling** for reverse proxies
2. **Add comprehensive header validation**
3. **Add signature replay attack protection** (timestamp validation)

**Refactor:**
```typescript
// Fix signature verification
export async function verifySignature(
    signature: string,
    method: string,
    path: string,
    headers: Record<string, string>
): Promise<boolean> {
    try {
        const sigParams = parseSignatureHeader(signature)
        if (!sigParams) {
            return false
        }

        // Validate required headers are present
        for (const header of sigParams.headers) {
            const headerKey = header.toLowerCase()
            if (headerKey !== '(request-target)' && !headers[headerKey]) {
                console.error(`[Signature] Missing required header: ${header}`)
                return false
            }
        }

        // Validate date header (prevent replay attacks)
        const dateHeader = headers['date']
        if (dateHeader) {
            const requestDate = new Date(dateHeader)
            const now = new Date()
            const diff = Math.abs(now.getTime() - requestDate.getTime())
            if (diff > 5 * 60 * 1000) { // 5 minutes
                console.error('[Signature] Request too old or too far in future')
                return false
            }
        }

        // ... rest of verification
    } catch (error) {
        return false
    }
}
```

---

### 🟡 MEDIUM: Public Key Caching

**Issue:** Public keys are cached for 1 hour without validation of key rotation.

**Location:**
- `src/lib/httpSignature.ts`: Lines 10-11, 168-212

**Proposal:**
- Add cache invalidation on signature failure
- Consider shorter TTL for public keys
- Add key rotation detection

---

## 4. SSRF Protection

### 🟠 HIGH: SSRF Protection Gaps

**Issue:** SSRF protection exists but has limitations (Verified):

1. **Development mode bypass**: Allows localhost in dev
2. **IPv6 validation incomplete**: Regex patterns may not catch all IPv6 private ranges
3. **DNS rebinding risk**: No validation that resolved IP matches hostname (Confirmed).
4. **No redirect protection**: `safeFetch` doesn't follow redirects safely (Confirmed).

**Location:**
- `src/lib/ssrfProtection.ts`

**Proposal:**
1. **Improve IPv6 validation**
2. **Add DNS resolution validation**
3. **Add redirect handling** with validation
4. **Consider allowlist approach** for known-good domains

**Refactor:**
```typescript
export async function isUrlSafe(urlString: string): Promise<boolean> {
    try {
        const url = new URL(urlString)
        
        // Check protocol
        if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
            return false
        }

        // Resolve DNS and verify IP
        const dns = await import('dns/promises')
        const addresses = await dns.resolve4(url.hostname).catch(() => [])
        const addresses6 = await dns.resolve6(url.hostname).catch(() => [])
        
        const allAddresses = [...addresses, ...addresses6]
        
        for (const addr of allAddresses) {
            if (isPrivateIP(addr)) {
                return false
            }
        }

        // ... rest of validation
    } catch {
        return false
    }
}

// Add redirect handling
export async function safeFetch(
    url: string,
    options?: RequestInit,
    maxRedirects: number = 5
): Promise<Response> {
    if (!await isUrlSafe(url)) {
        throw new Error(`URL is not safe to fetch: ${url}`)
    }
    
    // Use fetch with redirect: 'manual' and validate each redirect
    // ... implementation
}
```

---

### 🟡 MEDIUM: Missing Rate Limiting

**Issue:** Rate limiting middleware exists (`src/middleware/rateLimit.ts`) but is **NOT APPLIED** to public endpoints like `search.ts` and `userSearch.ts`.

**Proposal:**
- Apply rate limiting for external fetches
- Implement request queuing
- Add timeout handling

---

## 5. ActivityPub Federation Security

### ✅ FIXED: Activity Processing Race Conditions

**Status:** Verified.

---

### 🟡 MEDIUM: Remote Actor Validation

**Issue:** Remote actors are cached without full validation of their ActivityPub compliance.

**Location:**
- `src/lib/activitypubHelpers.ts`: `cacheRemoteUser` function
- `src/federation.ts`: Multiple places fetch and cache actors

**Proposal:**
- Validate actor schema strictly
- Verify actor URLs match WebFinger resolution
- Add actor validation before caching

---

### 🟡 MEDIUM: Activity ID Collision Risk

**Issue:** Activity IDs are generated using timestamps, which could collide.

**Location:**
- `src/services/ActivityBuilder.ts`: Multiple activity builders use `Date.now()` (Confirmed).

**Proposal:**
- Use UUIDs or cuid for activity IDs
- Ensure uniqueness in database

---

## 6. Database Security

### ✅ FIXED: Private Key Storage

**Status:** Verified. Private keys are encrypted at rest using AES-256-GCM encryption.

**Remaining Considerations:**
- Key rotation mechanism not yet implemented
- Consider hardware security modules for production deployments

---

### 🟡 MEDIUM: SQLite in Production

**Issue:** Using SQLite for production (not inherently insecure, but has limitations).

**Proposal:**
- Create Docker Compose production setup that includes PostgreSQL
- Add connection pooling if moving to PostgreSQL
- Add database backup strategy

---

### 🟡 MEDIUM: Missing Database Indexes

**Issue:** Some queries may be slow without proper indexes.

**Proposal:**
- Review query patterns
- Add indexes for frequently queried fields
- Consider composite indexes for common query patterns

---

## 7. Error Handling & Information Disclosure

### ✅ FIXED: Information Disclosure in Errors

**Status:** Verified. Structured error handling implemented.

---

### ✅ FIXED: Missing Request Timeouts

**Status:** Verified. `safeFetch()` has 30-second default timeout.

---

## 8. Code Quality & Maintainability

### ✅ FIXED: Prisma Client Instances

**Status:** Verified. Singleton pattern used.

---

### 🟡 MEDIUM: Duplicate Code

**Issue:** Similar patterns repeated across files:

1. **URL construction** (`getBaseUrl()` + path concatenation)
2. **User lookup patterns**
3. **Event lookup with remote/local handling**
4. **Addressing logic** duplicated in multiple places

**Proposal:**
- Extract common patterns to utilities
- Create helper functions for common operations
- Reduce duplication in audience resolution

---

### 🟡 MEDIUM: Type Safety

**Issue:** Many `any` types used, reducing type safety.

**Location:**
- `src/federation.ts`: Activity types are `any`
- `src/services/ActivityBuilder.ts`: Return types are `any`
- `src/lib/httpSignature.ts`: Actor types are `any`

**Proposal:**
- Create proper TypeScript interfaces for ActivityPub types
- Use Zod schemas for runtime validation
- Remove `any` types where possible

---

### 🟢 LOW: Code Organization

**Issue:** Some files are getting large (e.g., `federation.ts` is 961 lines).

**Proposal:**
- Split large files into smaller modules
- Group related functionality
- Consider feature-based organization

---

## 9. Configuration & Environment

### ✅ FIXED: Hardcoded Defaults

**Status:** Verified. Centralized configuration implemented in `src/config.ts`.

---

### ✅ FIXED: CORS Configuration

**Status:** Verified. CORS configuration made environment-variable based.

---

## 10. Real-time Security

### 🟡 MEDIUM: SSE Authentication

**Issue:** SSE endpoint (`src/realtime.ts`) doesn't require authentication, but uses optional userId. Allows anonymous connections.

**Location:**
- `src/realtime.ts`: Line 23-28

**Proposal:**
- Make authentication required for SSE
- Add rate limiting per user
- Validate user session on connection

---

### 🟡 MEDIUM: Broadcast Security

**Issue:** Broadcast function sends to all clients - no filtering for sensitive data.

**Location:**
- `src/realtime.ts`: `broadcast` function

**Proposal:**
- Filter sensitive data before broadcasting
- Implement per-user filtering
- Add broadcast rate limiting

---

## 11. Missing Security Features

### 🟡 MEDIUM: Rate Limiting Not Applied

**Issue:** Rate limiting middleware exists but not yet applied to routes.

**Status:** 
- Rate limiting middleware implemented in `src/middleware/rateLimit.ts`
- **Action Required:** Apply rate limiting middleware to sensitive endpoints (e.g. `search.ts`, `userSearch.ts`).

**Proposal:**
- Apply `strictRateLimit` to auth endpoints (login, signup)
- Apply `moderateRateLimit` to write operations
- Apply `lenientRateLimit` to read operations
- Consider Redis for multi-instance deployments

---

### 🟠 HIGH: No CSRF Protection

**Issue:** No CSRF tokens for state-changing operations.

**Proposal:**
- Add CSRF protection for web forms
- Use SameSite cookies
- Verify Origin header for API requests

---

### ✅ FIXED: Missing Security Headers

**Status:** Verified. Security headers middleware implemented.

---

### 🟡 MEDIUM: No Input Sanitization

**Issue:** No explicit HTML sanitization for user content.

**Proposal:**
- Add HTML sanitization library (DOMPurify server-side or similar)
- Sanitize all user inputs
- Sanitize ActivityPub content from remote instances

---

## 12. ActivityPub-Specific Issues

### 🟠 HIGH: Activity ID Uniqueness

**Issue:** Activity IDs use timestamps which could collide.

**Location:**
- `src/services/ActivityBuilder.ts`: Multiple functions use `Date.now()`

**Proposal:**
- Use UUIDs or cuid for activity IDs
- Ensure database uniqueness constraint

---

### 🟡 MEDIUM: Missing Activity Validation

**Issue:** Activities are validated with Zod, but some edge cases may be missed.

**Proposal:**
- Comprehensive ActivityPub schema validation
- Validate all required fields
- Validate URL formats in activities

---

### 🟡 MEDIUM: Inbox Processing

**Issue:** Inbox processing is async but errors are silently caught.

**Location:**
- `src/activitypub.ts`: Lines 503, 560

**Proposal:**
- Add proper error logging
- Implement dead letter queue for failed activities
- Add retry mechanism for transient failures

---

## Summary of Proposed Refactors

### ✅ Verified Fixed

1. ✅ **Fixed authentication inconsistencies**
2. ✅ **Fixed signature verification bug**
3. ✅ **Encrypted private keys**
4. ✅ **Added environment validation**
5. ✅ **Fixed race condition**
6. ✅ **Refactored Prisma client**
7. ✅ **Added authorization helpers**
8. ✅ **Added admin role support**
9. ✅ **Improved error handling**
10. ✅ **Added security headers**
11. ✅ **Added request timeouts**
12. ✅ **Made CORS configurable**

### Remaining High Priority

1. **Improve SSRF protection** - DNS validation, redirect handling
2. **Add CSRF protection**
3. **Apply rate limiting** - Middleware exists, needs to be applied to routes
4. **Fix Activity ID uniqueness** - Use UUIDs

### Remaining Medium Priority

1. **Add input sanitization** - HTML sanitization for user content
2. **Secure SSE** - Require auth
3. **Improve signature verification** - Add replay protection
4. **Improve type safety** - Remove `any` types
5. **Improve code organization** - Split large files
6. **Add comprehensive logging** - Structured logging

### Low Priority

1. **Code organization** - Feature-based structure
2. **Documentation** - Security documentation
3. **Testing** - Security-focused tests

---

## Testing Recommendations

1. **Penetration testing** - External security audit
2. **Fuzzing** - Input fuzzing for ActivityPub endpoints
3. **Load testing** - Test under high load
4. **Dependency scanning** - Regular dependency updates
5. **Code review** - Regular security code reviews

---

## Compliance Considerations

- **GDPR**: User data handling, right to deletion
- **ActivityPub**: Protocol compliance
- **OWASP Top 10**: Address all relevant items

---

## Next Steps

1. Review and prioritize this audit
2. Create tickets for each issue
3. Implement fixes starting with critical items
4. Re-audit after major changes
5. Establish security review process

---

**End of Security Audit**
