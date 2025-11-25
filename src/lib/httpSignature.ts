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
            return `${header}: ${headers[header]}`
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
        // Parse signature header
        const sigParams = parseSignatureHeader(signature)
        if (!sigParams) {
            console.error('[Signature] Failed to parse signature header')
            return false
        }

        const { keyId, algorithm, headers: headersToVerify, signature: sig } = sigParams

        // Only support rsa-sha256
        if (algorithm !== 'rsa-sha256') {
            console.error(`[Signature] Unsupported algorithm: ${algorithm}`)
            return false
        }

        // Fetch the public key
        const publicKey = await fetchPublicKey(keyId)
        if (!publicKey) {
            console.error(`[Signature] Failed to fetch public key from: ${keyId}`)
            return false
        }

        // Build signature string
        const signatureString = headersToVerify
            .map((header) => {
                if (header === '(request-target)') {
                    return `(request-target): ${method.toLowerCase()} ${path}`
                }
                const headerValue = headers[header.toLowerCase()]
                if (!headerValue) {
                    console.error(`[Signature] Missing header: ${header}`)
                }
                return `${header}: ${headerValue || ''}`
            })
            .join('\n')

        // Verify signature
        const verify = createVerify('SHA256')
        verify.update(signatureString)
        verify.end()
        const isValid = verify.verify(publicKey, sig, 'base64')
        
        if (!isValid) {
            console.error(`[Signature] Verification failed for keyId: ${keyId}`)
            console.error(`[Signature] Method: ${method}, Path: ${path}`)
            console.error(`[Signature] Headers to verify: ${headersToVerify.join(', ')}`)
            console.error(`[Signature] Signature string:\n${signatureString}`)
        }
        
        return isValid
    } catch (error) {
        console.error('[Signature] Verification error:', error)
        return false
    }
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
        const params: Record<string, string> = {}

        // Parse key="value" pairs
        const regex = /(\w+)="([^"]+)"/g
        let match
        while ((match = regex.exec(header)) !== null) {
            params[match[1]] = match[2]
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
    } catch (error) {
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

        const actor: any = await response.json()

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
