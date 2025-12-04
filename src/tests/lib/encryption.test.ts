/**
 * Tests for Encryption Utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { encryptPrivateKey, decryptPrivateKey, isEncrypted } from '../../lib/encryption.js'
import { config } from '../../config.js'

describe('Encryption', () => {
    const testPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj
MzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b50Z
8pXqnU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7VJTUt9Us8c
KjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b50Z
8pXqnU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7VJTUt9Us8c
KjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b50Z
AgMBAAECggEBAK8+1ZV1a2k3+7xZV1a2k3+7xZV1a2k3+7xZV1a2k3+7xZV1a2k3+
7xZV1a2k3+7xZV1a2k3+7xZV1a2k3+7xZV1a2k3+7xZV1a2k3+7xZV1a2k3+7xZV1a
2k3+7xZV1a2k3+7xZV1a2k3+7xZV1a2k3+7xZV1a2k3+7xZV1a2k3+7xZV1a2k3+7x
ZV1a2k3+7xZV1a2k3+7xZV1a2k3+7xZV1a2k3+7xZV1a2k3+7xZV1a2k3+7xZV1a2k
3+7xZV1a2k3+7xZV1a2k3+7xZV1a2k3+7xZV1a2k3+7xZV1a2k3+7xZV1a2k3+7xZV
1a2k3+7xZV1a2k3+7xZV1a2k3+7xZV1a2k3+7xZV1a2k3+7xZV1a2k3+7xZV1a2k3+
QKBgQDy5XJTU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7VJTUt
9Us8cKjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R4/M
2b50Z8pXqnU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7VJTUt9U
s8cKjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b5
0Z8pXqnU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7VJTUt9Us8c
QKBgQDy5XJTU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7VJTUt
9Us8cKjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R4/M
2b50Z8pXqnU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7VJTUt9U
s8cKjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b5
0Z8pXqnU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7VJTUt9Us8c
AwEAAQKCAQEAy5XJTU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8v
C7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7VJTUt9Us8cKjMzEfYyjiWA
4R4/M2b50Z8pXqnU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7V
JTUt9Us8cKjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7vC7VJTUt9Us8cKjMzEfYyjiW
A4R4/M2b50Z8pXqnU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7V
JTUt9Us8cKjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R
4/M2b50Z8pXqnU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7VJTUt
9Us8cKjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b
50Z8pXqnU1X8vC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b50Z8pXqnU1X8vC7VJTUt9Us8c
-----END PRIVATE KEY-----`

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('encryptPrivateKey', () => {
        it('should encrypt a private key', () => {
            const encrypted = encryptPrivateKey(testPrivateKey)

            expect(encrypted).toBeTruthy()
            expect(encrypted).not.toBe(testPrivateKey)
            expect(encrypted.split(':')).toHaveLength(3) // iv:authTag:encrypted
        })

        it('should produce different encrypted values for same key', () => {
            const encrypted1 = encryptPrivateKey(testPrivateKey)
            const encrypted2 = encryptPrivateKey(testPrivateKey)

            expect(encrypted1).not.toBe(encrypted2) // Different IVs = different encrypted values
        })

        it('should throw error for empty private key', () => {
            expect(() => encryptPrivateKey('')).toThrow('Cannot encrypt empty private key')
        })

        it('should handle various key formats', () => {
            const shortKey = 'test-key-123'
            const encrypted = encryptPrivateKey(shortKey)

            expect(encrypted).toBeTruthy()
            expect(encrypted.split(':')).toHaveLength(3)
        })
    })

    describe('decryptPrivateKey', () => {
        it('should decrypt an encrypted private key', () => {
            const encrypted = encryptPrivateKey(testPrivateKey)
            const decrypted = decryptPrivateKey(encrypted)

            expect(decrypted).toBe(testPrivateKey)
        })

        it('should return null for null input', () => {
            expect(decryptPrivateKey(null)).toBeNull()
        })

        it('should throw error for invalid format (not 3 parts)', () => {
            const invalid = 'invalid:format'

            expect(() => decryptPrivateKey(invalid)).toThrow(
                'Invalid encrypted key format'
            )
        })

        it('should throw error for corrupted encrypted data', () => {
            const corrupted = 'a'.repeat(32) + ':' + 'b'.repeat(32) + ':' + 'c'.repeat(32)

            expect(() => decryptPrivateKey(corrupted)).toThrow(
                'Failed to decrypt private key'
            )
        })

        it('should reject plaintext keys with clear error', () => {
            const plaintext = 'plaintext-key'

            expect(() => decryptPrivateKey(plaintext)).toThrow(
                'Invalid encrypted key format'
            )
        })
    })

    describe('isEncrypted', () => {
        it('should return true for encrypted key format', () => {
            const encrypted = encryptPrivateKey(testPrivateKey)
            expect(isEncrypted(encrypted)).toBe(true)
        })

        it('should return false for null', () => {
            expect(isEncrypted(null)).toBe(false)
        })

        it('should return false for empty string', () => {
            expect(isEncrypted('')).toBe(false)
        })

        it('should return false for plaintext key', () => {
            expect(isEncrypted(testPrivateKey)).toBe(false)
        })

        it('should return false for invalid format (2 parts)', () => {
            expect(isEncrypted('part1:part2')).toBe(false)
        })

        it('should return true for format with 3 parts', () => {
            expect(isEncrypted('iv:authTag:encrypted')).toBe(true)
        })
    })

    describe('encrypt/decrypt roundtrip', () => {
        it('should successfully encrypt and decrypt various keys', () => {
            const keys = [
                testPrivateKey,
                'short-key',
                'a'.repeat(100),
                'key-with-special-chars-!@#$%^&*()',
            ]

            for (const key of keys) {
                const encrypted = encryptPrivateKey(key)
                const decrypted = decryptPrivateKey(encrypted)

                expect(decrypted).toBe(key)
            }
        })

        it('should handle unicode characters', () => {
            const unicodeKey = 'key-with-unicode-测试-🚀'
            const encrypted = encryptPrivateKey(unicodeKey)
            const decrypted = decryptPrivateKey(encrypted)

            expect(decrypted).toBe(unicodeKey)
        })
    })
})

