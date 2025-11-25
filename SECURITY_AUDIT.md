# Security Audit & Refactoring Proposals
## Stellar Calendar - ActivityPub Federated Calendar Platform

**Date:** 2025-01-27  
**Scope:** Full codebase security review, code quality assessment, and maintainability analysis

---

## Executive Summary

This audit identifies **critical security vulnerabilities**, **moderate security concerns**, and **code quality improvements** across the codebase. The application implements ActivityPub federation with HTTP signatures, SSRF protection, and user authentication.

**Update (2025-01-27):** All critical security issues have been resolved:
- ✅ Authentication inconsistencies fixed - all endpoints use `requireAuth(c)`
- ✅ Signature verification bug fixed
- ✅ Private keys encrypted at rest
- ✅ Environment validation implemented
- ✅ Activity processing race condition fixed

**Remaining High Priority Issues:**
- Multiple PrismaClient instances (17 instances) - connection pool risk
- Missing authorization helpers (`requireOwnership`, `requireAdmin`)
- Missing admin role support for moderation endpoints

**Priority Levels:**
- 🔴 **CRITICAL** - Immediate action required
- 🟠 **HIGH** - Address soon
- 🟡 **MEDIUM** - Should be addressed
- 🟢 **LOW** - Nice to have

---

## 1. Authentication & Authorization Issues

### ✅ FIXED: Inconsistent Authentication Mechanisms

**Status:** All endpoints now use `requireAuth(c)` helper consistently. All `x-user-id` header usage has been removed.

---

### 🟠 HIGH: Missing Authorization Helpers

**Issue:** While authentication is now consistent, authorization helpers are missing:

1. **No `requireOwnership()` helper** - Ownership checks are implemented inline (e.g., `src/events.ts:741`), but a reusable helper would improve consistency
2. **No `requireAdmin()` helper** - Moderation endpoints use `requireAuth()` but don't verify admin status
3. **Missing `isAdmin` field** - User model doesn't have admin role field

**Location:**
- `src/middleware/auth.ts`: Only has `requireAuth()`, missing ownership and admin helpers
- `src/moderation.ts`: All endpoints use `requireAuth()` but no admin verification
- `src/events.ts`: Ownership check implemented inline (line 741)

**Proposal:**
- Create `requireOwnership()` helper for consistent ownership verification
- Create `requireAdmin()` helper for moderation endpoints
- Add `isAdmin` boolean field to User model in Prisma schema
- Update moderation endpoints to use `requireAdmin()`

**Refactor:**
```typescript
// Add to src/middleware/auth.ts
export async function requireOwnership(
    c: Context, 
    resourceUserId: string | null,
    resourceName: string = 'resource'
): Promise<void> {
    const userId = requireAuth(c)
    if (resourceUserId !== userId) {
        throw new Error(`Forbidden: You don't own this ${resourceName}`)
    }
}

export async function requireAdmin(c: Context): Promise<void> {
    const userId = requireAuth(c)
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isAdmin: true }
    })
    if (!user?.isAdmin) {
        throw new Error('Forbidden: Admin access required')
    }
}
```

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

**Status:** Variable name bug fixed. Signature verification now uses correct `signature` variable.

---

### 🟠 HIGH: Signature Verification Improvements Needed

**Issue:** While the critical bug is fixed, signature verification could be improved:

1. **Host header manipulation** (`src/activitypub.ts:479-482`): Modifies host header for reverse proxy, but logic may be flawed
2. **Missing header validation**: Doesn't verify all required headers are present before verification
3. **No signature replay attack protection**: Missing timestamp validation

**Location:**
- `src/activitypub.ts`: Lines 460-489 (personal inbox)
- `src/activitypub.ts`: Lines 518-546 (shared inbox)
- `src/lib/httpSignature.ts`: Lines 64-125

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

**Issue:** SSRF protection exists but has limitations:

1. **Development mode bypass** (`src/lib/ssrfProtection.ts:35-39`): Allows localhost in dev
2. **IPv6 validation incomplete**: Regex patterns may not catch all IPv6 private ranges
3. **DNS rebinding risk**: No validation that resolved IP matches hostname
4. **No redirect protection**: `safeFetch` doesn't follow redirects safely

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

**Issue:** No rate limiting on external fetch operations, allowing potential DoS.

**Proposal:**
- Add rate limiting for external fetches
- Implement request queuing
- Add timeout handling

---

## 5. ActivityPub Federation Security

### ✅ FIXED: Activity Processing Race Conditions

**Status:** Race condition fixed. Activity deduplication now uses atomic `create()` with unique constraint and handles `P2002` errors to prevent duplicate processing.

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
- `src/services/ActivityBuilder.ts`: Multiple activity builders use `Date.now()`

**Proposal:**
- Use UUIDs or cuid for activity IDs
- Ensure uniqueness in database

---

## 6. Database Security

### ✅ FIXED: Private Key Storage

**Status:** Private keys are now encrypted at rest using AES-256-GCM encryption. Encryption utilities implemented in `src/lib/encryption.ts`. Keys are encrypted before storage and decrypted when needed. Supports migration from plaintext keys in development.

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

### 🟠 HIGH: Information Disclosure in Errors

**Issue:** Error messages may leak sensitive information:

1. **Stack traces** in production responses
2. **Database errors** exposed to clients
3. **File paths** in error messages

**Location:**
- Throughout codebase - all catch blocks return generic errors, but console.error may log sensitive info

**Proposal:**
1. **Structured error handling** with error codes
2. **Sanitize error messages** before sending to clients
3. **Log errors securely** without sensitive data
4. **Use error monitoring** (Sentry, etc.)

**Refactor:**
```typescript
// Create error handling utility
export class AppError extends Error {
    constructor(
        public code: string,
        message: string,
        public statusCode: number = 500,
        public details?: any
    ) {
        super(message)
        this.name = 'AppError'
    }
}

export function handleError(error: unknown, c: Context): Response {
    if (error instanceof AppError) {
        return c.json({
            error: error.code,
            message: error.message,
            ...(process.env.NODE_ENV === 'development' && { details: error.details })
        }, error.statusCode)
    }
    
    // Log full error server-side
    console.error('Unhandled error:', error)
    
    // Return generic error to client
    return c.json({
        error: 'INTERNAL_ERROR',
        message: 'An internal error occurred'
    }, 500)
}
```

---

### 🟡 MEDIUM: Missing Request Timeouts

**Issue:** No explicit timeouts on external requests.

**Location:**
- `src/lib/activitypubHelpers.ts`: `fetchActor`, `resolveWebFinger`
- `src/services/ActivityDelivery.ts`: `deliverToInbox`

**Proposal:**
- Add timeout to all fetch operations
- Use AbortController for timeouts
- Implement retry logic with exponential backoff (partially exists)

---

## 8. Code Quality & Maintainability

### 🟠 HIGH: Prisma Client Instances

**Issue:** **17 separate PrismaClient instances** created throughout codebase. This can lead to connection pool exhaustion and performance issues.

**Location:**
- `src/lib/activitypubHelpers.ts`
- `src/server.ts`
- `src/federation.ts`
- `src/moderation.ts`
- `src/profile.ts`
- `src/events.ts`
- `src/services/ActivityDelivery.ts`
- `src/auth.ts`
- `src/activitypub.ts`
- `src/lib/audience.ts`
- `src/comments.ts`
- `src/attendance.ts`
- `src/likes.ts`
- `src/userSearch.ts`
- `src/middleware/auth.ts`
- `src/calendar.ts`
- `src/search.ts`

**Risk:** Each instance creates its own connection pool. With 17 instances, this can exhaust database connections, especially with SQLite.

**Proposal:**
- **Create singleton Prisma client** to avoid connection pool exhaustion
- **Export from central location** (`src/lib/prisma.ts`)
- **Replace all `new PrismaClient()` with import from singleton**

**Refactor:**
```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}
```

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

**Status:** Centralized configuration implemented in `src/config.ts`. Environment variables are validated on startup. Required variables fail fast in production. Sensible defaults provided for development only.

---

### 🟡 MEDIUM: CORS Configuration

**Issue:** CORS allows localhost origins - should be configurable.

**Location:**
- `src/server.ts`: Lines 30-33

**Proposal:**
- Make CORS origins configurable via environment variables
- Validate origins against allowlist

---

## 10. Real-time Security

### 🟡 MEDIUM: SSE Authentication

**Issue:** SSE endpoint doesn't require authentication, but uses optional userId.

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

### 🟠 HIGH: No Rate Limiting

**Issue:** No rate limiting on any endpoints.

**Proposal:**
- Implement rate limiting middleware
- Use Redis or in-memory store
- Different limits for authenticated vs anonymous
- Stricter limits for sensitive operations

---

### 🟠 HIGH: No CSRF Protection

**Issue:** No CSRF tokens for state-changing operations.

**Proposal:**
- Add CSRF protection for web forms
- Use SameSite cookies
- Verify Origin header for API requests

---

### 🟡 MEDIUM: Missing Security Headers

**Issue:** No security headers set.

**Proposal:**
- Add security headers middleware:
  - `Content-Security-Policy`
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `Strict-Transport-Security` (if HTTPS)
  - `Referrer-Policy`

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

### ✅ Completed Critical Fixes

1. ✅ **Fixed authentication inconsistencies** - All endpoints now use `requireAuth(c)`, removed all `x-user-id` header usage
2. ✅ **Fixed signature verification bug** - Variable name error in `activitypub.ts:484` corrected
3. ✅ **Encrypted private keys** - AES-256-GCM encryption implemented for keys at rest
4. ✅ **Added environment validation** - Centralized config with fail-fast validation
5. ✅ **Fixed race condition** - Activity processing deduplication now uses atomic operations

### Immediate Actions (High Priority)

1. **Refactor Prisma client** - Replace 17 instances with singleton pattern (connection pool risk)
2. **Add authorization helpers** - Implement `requireOwnership()` and `requireAdmin()` helpers
3. **Add admin role support** - Add `isAdmin` field to User model and protect moderation endpoints

### High Priority

1. **Add rate limiting** - Protect all endpoints
2. **Improve SSRF protection** - DNS validation, redirect handling
3. **Add authorization checks** - Verify ownership on all operations
4. **Improve error handling** - Structured errors, no information disclosure
5. **Add security headers** - CSP, HSTS, etc.

### Medium Priority

1. **Refactor Prisma client** - Singleton pattern
2. **Improve type safety** - Remove `any` types
3. **Add input sanitization** - HTML sanitization
4. **Improve code organization** - Split large files
5. **Add comprehensive logging** - Structured logging

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

