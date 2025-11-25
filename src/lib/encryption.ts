/**
 * Encryption Utilities
 * Encrypts and decrypts private keys at rest
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { config } from '../config.js'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Encrypts a private key for storage
 * @param privateKey - Plaintext private key
 * @returns Encrypted key string (format: iv:authTag:encrypted)
 */
export function encryptPrivateKey(privateKey: string): string {
    if (!privateKey) {
        throw new Error('Cannot encrypt empty private key')
    }

    const iv = randomBytes(IV_LENGTH)
    const key = Buffer.from(config.encryptionKey, 'hex')
    
    const cipher = createCipheriv(ALGORITHM, key, iv)
    
    let encrypted = cipher.update(privateKey, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypts a private key from storage
 * @param encryptedKey - Encrypted key string (format: iv:authTag:encrypted)
 * @returns Plaintext private key
 */
export function decryptPrivateKey(encryptedKey: string | null): string | null {
    if (!encryptedKey) {
        return null
    }

    try {
        const parts = encryptedKey.split(':')
        if (parts.length !== 3) {
            // Legacy: if not in encrypted format, assume it's plaintext (for migration)
            // In production, this should throw an error after migration is complete
            if (config.isProduction) {
                console.warn('⚠️  Attempting to decrypt non-encrypted key in production')
            }
            return encryptedKey
        }

        const [ivHex, authTagHex, encrypted] = parts
        const iv = Buffer.from(ivHex, 'hex')
        const authTag = Buffer.from(authTagHex, 'hex')
        const key = Buffer.from(config.encryptionKey, 'hex')
        
        const decipher = createDecipheriv(ALGORITHM, key, iv)
        decipher.setAuthTag(authTag)
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8')
        decrypted += decipher.final('utf8')
        
        return decrypted
    } catch (error) {
        console.error('Error decrypting private key:', error)
        // In production, fail hard. In development, return null to allow graceful handling
        if (config.isProduction) {
            throw new Error('Failed to decrypt private key')
        }
        return null
    }
}

/**
 * Checks if a key is encrypted (has the encrypted format)
 * @param key - Key string to check
 * @returns True if key appears to be encrypted
 */
export function isEncrypted(key: string | null): boolean {
    if (!key) {
        return false
    }
    // Encrypted keys have format: iv:authTag:encrypted (3 parts separated by :)
    return key.split(':').length === 3
}

