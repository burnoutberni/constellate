/**
 * HTTP Signature Implementation
 * Signs and verifies HTTP requests using RSA-SHA256
 */

import { createSign, createVerify } from 'crypto'
import { safeFetch } from './ssrfProtection.js'

// Cache for public keys to reduce fetches
const publicKeyCache = new Map<string, { key: string; timestamp: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

/**
 * Generates an HTTP signature for a request
 * @param privateKey - PEM-formatted RSA private key
 * @param keyId - URL of the public key
 * @param method - HTTP method
 * @param path - Request path
 * @param headers - Request headers
 * @returns Signature header value
 */
export function signRequest(
    privateKey: string,
    keyId: string,
    method: string,
    path: string,
    headers: Record<string, string>
): string {
    const headersToSign = ['(request-target)', 'host', 'date']

    // Add digest if present (for POST/PUT requests)
    if (headers['digest']) {
        headersToSign.push('digest')
    }

    // Build signature string
    const signatureString = headersToSign
        .map((header) => {
            if (header === '(request-target)') {
                return `(request-target): ${method.toLowerCase()} ${path}`
            }
            // Find header value case-insensitively
            const headerLower = header.toLowerCase()
            const headerValue = headers[headerLower] ||
                Object.entries(headers).find(([key]) => key.toLowerCase() === headerLower)?.[1]
            if (!headerValue) {
                throw new Error(`Missing header: ${header}`)
            }
            return `${header}: ${headerValue}`
        })
        .join('\n')

    // Sign the string
    const sign = createSign('SHA256')
    sign.update(signatureString)
    sign.end()
    const signature = sign.sign(privateKey, 'base64')

    // Build signature header
    return `keyId="${keyId}",algorithm="rsa-sha256",headers="${headersToSign.join(' ')}",signature="${signature}"`
}

/**
 * Verifies an HTTP signature
 * @param signature - Signature header value
 * @param method - HTTP method
 * @param path - Request path
 * @param headers - Request headers
 * @returns True if signature is valid
 */
export async function verifySignature(
    signature: string,
    method: string,
    path: string,
    headers: Record<string, string>
): Promise<boolean> {
    try {
        const sigParams = parseSignatureHeader(signature)
        if (!sigParams) {
            console.error('[Signature] Failed to parse signature header')
            return false
        }

        if (!isSupportedAlgorithm(sigParams.algorithm)) {
            return false
        }

        if (!isRequestDateValid(headers['date'])) {
            return false
        }

        const publicKey = await fetchPublicKey(sigParams.keyId)
        if (!publicKey) {
            console.error(`[Signature] Failed to fetch public key from: ${sigParams.keyId}`)
            return false
        }

        const signatureString = buildSignatureString(sigParams.headers, method, path, headers)
        if (!signatureString) {
            return false
        }

        const verified = await verifyWithOptionalRefresh(publicKey, sigParams.keyId, signatureString, sigParams.signature)

        if (!verified) {
            logVerificationFailure(sigParams, method, path, signatureString)
        }

        return verified
    } catch (error) {
        console.error('[Signature] Verification error:', error)
        return false
    }
}

function isSupportedAlgorithm(algorithm: string) {
    if (algorithm !== 'rsa-sha256') {
        console.error(`[Signature] Unsupported algorithm: ${algorithm}`)
        return false
    }
    return true
}

function isRequestDateValid(dateHeader?: string) {
    if (!dateHeader) {
        console.error('[Signature] Missing Date header')
        return false
    }

    const requestDate = new Date(dateHeader)
    const now = new Date()
    const diff = Math.abs(now.getTime() - requestDate.getTime())

    if (diff > 5 * 60 * 1000) {
        console.error('[Signature] Request too old or too far in future')
        console.error(`[Signature] Request date: ${dateHeader}, Current: ${now.toISOString()}, Diff: ${diff}ms`)
        return false
    }
    return true
}

function findHeaderValue(headers: Record<string, string>, header: string) {
    const headerLower = header.toLowerCase()
    return headers[headerLower] || Object.entries(headers).find(([key]) => key.toLowerCase() === headerLower)?.[1]
}

function buildSignatureString(headersToVerify: string[], method: string, path: string, headers: Record<string, string>) {
    const signatureStringParts: string[] = []

    for (const header of headersToVerify) {
        if (header === '(request-target)') {
            signatureStringParts.push(`(request-target): ${method.toLowerCase()} ${path}`)
            continue
        }

        const headerValue = findHeaderValue(headers, header)
        if (!headerValue) {
            console.error(`[Signature] Missing header: ${header}`)
            return null
        }

        signatureStringParts.push(`${header}: ${headerValue}`)
    }

    return signatureStringParts.join('\n')
}

async function verifyWithOptionalRefresh(publicKey: string, keyId: string, signatureString: string, sig: string) {
    const verify = createVerify('SHA256')
    verify.update(signatureString)
    verify.end()
    let isValid = verify.verify(publicKey, sig, 'base64')

    if (isValid) return true

    console.log('[Signature] Verification failed, refreshing public key and retrying')
    publicKeyCache.delete(keyId)

    const freshKey = await fetchPublicKey(keyId)
    if (freshKey && freshKey !== publicKey) {
        const retryVerify = createVerify('SHA256')
        retryVerify.update(signatureString)
        retryVerify.end()
        isValid = retryVerify.verify(freshKey, sig, 'base64')

        if (isValid) {
            console.log('[Signature] Verification succeeded with fresh key')
            return true
        }
    }

    return false
}

function logVerificationFailure(sigParams: { keyId: string; headers: string[] }, method: string, path: string, signatureString: string) {
    console.error(`[Signature] Verification failed for keyId: ${sigParams.keyId}`)
    console.error(`[Signature] Method: ${method}, Path: ${path}`)
    console.error(`[Signature] Headers to verify: ${sigParams.headers.join(', ')}`)
    console.error(`[Signature] Signature string:\n${signatureString}`)
}

/**
 * Parses a Signature header
 * @param header - Signature header value
 * @returns Parsed signature parameters
 */
function parseSignatureHeader(header: string): {
    keyId: string
    algorithm: string
    headers: string[]
    signature: string
} | null {
    try {
        // Limit header length to prevent ReDoS attacks
        if (header.length > 10000) {
            return null
        }

        const params: Record<string, string> = {}

        // Parse key="value" pairs using a safer method to avoid ReDoS
        // Split by comma first, then parse each pair
        const pairs = header.split(',')
        for (const pair of pairs) {
            const trimmed = pair.trim()
            const equalIndex = trimmed.indexOf('=')
            if (equalIndex === -1) continue
            
            const key = trimmed.substring(0, equalIndex).trim()
            const valueWithQuotes = trimmed.substring(equalIndex + 1).trim()
            
            // Remove surrounding quotes
            if (valueWithQuotes.startsWith('"') && valueWithQuotes.endsWith('"')) {
                params[key] = valueWithQuotes.slice(1, -1)
            }
        }

        if (!params.keyId || !params.algorithm || !params.headers || !params.signature) {
            return null
        }

        return {
            keyId: params.keyId,
            algorithm: params.algorithm,
            headers: params.headers.split(' '),
            signature: params.signature,
        }
    } catch {
        return null
    }
}

/**
 * Fetches a public key from a keyId URL
 * @param keyId - URL of the public key (usually the actor URL + #main-key)
 * @returns PEM-formatted public key
 */
async function fetchPublicKey(keyId: string): Promise<string | null> {
    try {
        // Check cache first
        const cached = publicKeyCache.get(keyId)
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.key
        }

        // Extract actor URL from keyId (remove fragment)
        const actorUrl = keyId.split('#')[0]

        // Fetch actor object
        const response = await safeFetch(actorUrl, {
            headers: {
                Accept: 'application/activity+json',
            },
        })

        if (!response.ok) {
            return null
        }

        const actor = await response.json() as { publicKey?: { publicKeyPem?: string } }

        // Extract public key
        let publicKey: string | null = null

        if (actor.publicKey && actor.publicKey.publicKeyPem) {
            publicKey = actor.publicKey.publicKeyPem
        }

        if (publicKey) {
            // Cache the key
            publicKeyCache.set(keyId, {
                key: publicKey,
                timestamp: Date.now(),
            })
        }

        return publicKey
    } catch (error) {
        console.error('Error fetching public key:', error)
        return null
    }
}

/**
 * Creates a digest header for request body
 * @param body - Request body
 * @returns Digest header value
 */
export async function createDigest(body: string): Promise<string> {
    const crypto = await import('crypto')
    const hash = crypto.createHash('sha256')
    hash.update(body)
    return `SHA-256=${hash.digest('base64')}`
}
