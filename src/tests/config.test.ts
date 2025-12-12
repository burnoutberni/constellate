/**
 * Tests for Configuration Management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { randomBytes } from 'crypto'

describe('Configuration Management', () => {
	const originalEnv = process.env
	const originalConsoleWarn = console.warn
	const originalConsoleLog = console.log

	beforeEach(() => {
		// Reset environment
		process.env = { ...originalEnv }
		console.warn = originalConsoleWarn
		console.log = originalConsoleLog
		// Clear module cache to reload config
		vi.resetModules()
	})

	describe('Environment Variable Loading', () => {
		it('should use default PORT when not set', async () => {
			delete process.env.PORT
			process.env.DATABASE_URL = 'file:./test.db'
			process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')

			const { config } = await import('../config.js')
			expect(config.port).toBe(3000)
		})

		it('should use provided PORT', async () => {
			process.env.PORT = '8080'
			process.env.DATABASE_URL = 'file:./test.db'
			process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')

			const { config } = await import('../config.js')
			expect(config.port).toBe(8080)
		})

		it('should throw error when DATABASE_URL is missing', async () => {
			delete process.env.DATABASE_URL
			process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')

			await expect(async () => {
				await import('../config.js')
			}).rejects.toThrow('Required environment variable DATABASE_URL is missing')
		})

		it('should throw error when DATABASE_URL is missing in production', async () => {
			process.env.NODE_ENV = 'production'
			delete process.env.DATABASE_URL
			process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')

			await expect(async () => {
				await import('../config.js')
			}).rejects.toThrow('Required environment variable DATABASE_URL is missing')
		})

		it('should use default baseUrl when not set', async () => {
			delete process.env.BETTER_AUTH_URL
			process.env.DATABASE_URL = 'file:./test.db'
			process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')

			const { config } = await import('../config.js')
			expect(config.baseUrl).toBe('http://localhost:3000')
		})

		it('should throw error when baseUrl is missing in production', async () => {
			process.env.NODE_ENV = 'production'
			delete process.env.BETTER_AUTH_URL
			process.env.DATABASE_URL = 'file:./test.db'
			process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')

			await expect(async () => {
				await import('../config.js')
			}).rejects.toThrow(
				'Required environment variable BETTER_AUTH_URL is missing in production'
			)
		})

		it('should use provided baseUrl', async () => {
			process.env.BETTER_AUTH_URL = 'https://example.com'
			process.env.DATABASE_URL = 'file:./test.db'
			process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')

			const { config } = await import('../config.js')
			expect(config.baseUrl).toBe('https://example.com')
		})
	})

	describe('Encryption Key', () => {
		it('should auto-generate encryption key in development when not set', async () => {
			const originalEnv = process.env.NODE_ENV
			const originalVitest = process.env.VITEST
			const originalEncryptionKey = process.env.ENCRYPTION_KEY

			process.env.NODE_ENV = 'development'
			delete process.env.ENCRYPTION_KEY
			delete process.env.VITEST // Ensure VITEST is not set so warning is shown
			process.env.DATABASE_URL = 'file:./test.db'

			const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

			// Clear module cache to force re-import
			vi.resetModules()
			const { config } = await import('../config.js')

			expect(config.encryptionKey).toBeDefined()
			expect(config.encryptionKey.length).toBe(64)
			expect(consoleWarnSpy).toHaveBeenCalled()

			consoleWarnSpy.mockRestore()

			// Restore environment
			process.env.NODE_ENV = originalEnv
			if (originalVitest) process.env.VITEST = originalVitest
			if (originalEncryptionKey) process.env.ENCRYPTION_KEY = originalEncryptionKey
			vi.resetModules()
		})

		it('should not warn in test environment when auto-generating key', async () => {
			process.env.NODE_ENV = 'test'
			delete process.env.ENCRYPTION_KEY
			process.env.DATABASE_URL = 'file:./test.db'

			const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

			const { config } = await import('../config.js')

			expect(config.encryptionKey).toBeDefined()
			expect(config.encryptionKey.length).toBe(64)
			expect(consoleWarnSpy).not.toHaveBeenCalled()

			consoleWarnSpy.mockRestore()
		})

		it('should throw error when ENCRYPTION_KEY is missing in production', async () => {
			process.env.NODE_ENV = 'production'
			delete process.env.ENCRYPTION_KEY
			process.env.DATABASE_URL = 'file:./test.db'

			await expect(async () => {
				await import('../config.js')
			}).rejects.toThrow('ENCRYPTION_KEY is required in production')
		})

		it('should throw error when ENCRYPTION_KEY has wrong length', async () => {
			process.env.ENCRYPTION_KEY = 'too-short'
			process.env.DATABASE_URL = 'file:./test.db'

			await expect(async () => {
				await import('../config.js')
			}).rejects.toThrow('ENCRYPTION_KEY must be exactly 64 hex characters')
		})

		it('should accept valid 64-character hex encryption key', async () => {
			const validKey = randomBytes(32).toString('hex')
			process.env.ENCRYPTION_KEY = validKey
			process.env.DATABASE_URL = 'file:./test.db'

			const { config } = await import('../config.js')
			expect(config.encryptionKey).toBe(validKey)
		})

		it('should validate encryption key format after loading', async () => {
			// This tests the validation at the bottom of config.ts
			process.env.ENCRYPTION_KEY = 'a'.repeat(64)
			process.env.DATABASE_URL = 'file:./test.db'

			const { config } = await import('../config.js')
			expect(config.encryptionKey.length).toBe(64)
		})
	})

	describe('Better Auth Configuration', () => {
		it('should use default betterAuthUrl when not set', async () => {
			delete process.env.BETTER_AUTH_URL
			process.env.DATABASE_URL = 'file:./test.db'
			process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')

			const { config } = await import('../config.js')
			expect(config.betterAuthUrl).toBe('http://localhost:3000/api/auth')
		})

		it('should use provided betterAuthUrl', async () => {
			process.env.BETTER_AUTH_URL = 'https://auth.example.com'
			process.env.DATABASE_URL = 'file:./test.db'
			process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')

			const { config } = await import('../config.js')
			expect(config.betterAuthUrl).toBe('https://auth.example.com')
		})

		it('should parse BETTER_AUTH_TRUSTED_ORIGINS as comma-separated list', async () => {
			process.env.BETTER_AUTH_TRUSTED_ORIGINS = 'http://localhost:5173,https://example.com'
			process.env.DATABASE_URL = 'file:./test.db'
			process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')

			const { config } = await import('../config.js')
			expect(config.betterAuthTrustedOrigins).toEqual([
				'http://localhost:5173',
				'https://example.com',
			])
		})

		it('should use default BETTER_AUTH_TRUSTED_ORIGINS when not set', async () => {
			delete process.env.BETTER_AUTH_TRUSTED_ORIGINS
			process.env.DATABASE_URL = 'file:./test.db'
			process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')

			const { config } = await import('../config.js')
			expect(config.betterAuthTrustedOrigins).toEqual(['http://localhost:5173'])
		})
	})

	describe('CORS Configuration', () => {
		it('should parse CORS_ORIGINS as comma-separated list', async () => {
			process.env.CORS_ORIGINS = 'http://localhost:5173,https://example.com,http://app.local'
			process.env.DATABASE_URL = 'file:./test.db'
			process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')

			const { config } = await import('../config.js')
			expect(config.corsOrigins).toEqual([
				'http://localhost:5173',
				'https://example.com',
				'http://app.local',
			])
		})

		it('should use default CORS_ORIGINS when not set', async () => {
			delete process.env.CORS_ORIGINS
			process.env.DATABASE_URL = 'file:./test.db'
			process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')

			const { config } = await import('../config.js')
			expect(config.corsOrigins).toEqual(['http://localhost:5173', 'http://localhost:3000'])
		})
	})

	describe('Environment Detection', () => {
		it('should detect development environment', async () => {
			process.env.NODE_ENV = 'development'
			process.env.DATABASE_URL = 'file:./test.db'
			process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')

			const { config } = await import('../config.js')
			expect(config.isDevelopment).toBe(true)
			expect(config.isProduction).toBe(false)
			expect(config.nodeEnv).toBe('development')
		})

		it('should default to development when NODE_ENV is not set', async () => {
			delete process.env.NODE_ENV
			process.env.DATABASE_URL = 'file:./test.db'
			process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')

			const { config } = await import('../config.js')
			expect(config.nodeEnv).toBe('development')
			expect(config.isDevelopment).toBe(true)
		})
	})

	describe('Configuration Logging', () => {
		it('should log configuration in development', async () => {
			process.env.NODE_ENV = 'development'
			delete process.env.VITEST
			process.env.DATABASE_URL = 'file:./test.db'
			process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')

			const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

			await import('../config.js')

			expect(consoleLogSpy).toHaveBeenCalled()
			const logCalls = consoleLogSpy.mock.calls.map((call) => call[0]).join(' ')
			expect(logCalls).toContain('Configuration loaded')

			consoleLogSpy.mockRestore()
		})

		it('should not log configuration in test environment', async () => {
			process.env.NODE_ENV = 'test'
			process.env.DATABASE_URL = 'file:./test.db'
			process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')

			const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

			await import('../config.js')

			expect(consoleLogSpy).not.toHaveBeenCalled()

			consoleLogSpy.mockRestore()
		})

		it('should not log configuration when VITEST is set', async () => {
			process.env.NODE_ENV = 'development'
			process.env.VITEST = 'true'
			process.env.DATABASE_URL = 'file:./test.db'
			process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')

			const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

			await import('../config.js')

			expect(consoleLogSpy).not.toHaveBeenCalled()

			consoleLogSpy.mockRestore()
		})

		it('should log encryption key warning when auto-generated in development', async () => {
			process.env.NODE_ENV = 'development'
			delete process.env.VITEST
			delete process.env.ENCRYPTION_KEY
			process.env.DATABASE_URL = 'file:./test.db'

			const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

			await import('../config.js')

			expect(consoleLogSpy).toHaveBeenCalled()
			const logCalls = consoleLogSpy.mock.calls.map((call) => call[0]).join(' ')
			expect(logCalls).toContain('Using auto-generated encryption key')

			consoleLogSpy.mockRestore()
		})
	})
})
