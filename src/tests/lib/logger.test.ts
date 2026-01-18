import { describe, it, expect, beforeEach, vi } from 'vitest'
import { logger, formatMessage, shouldLog, type LogLevel } from '../../lib/logger.js'

describe('Logger Utilities', () => {
	describe('formatMessage', () => {
		it('formats debug messages with uppercase prefix', () => {
			expect(formatMessage('debug', 'test message')).toBe('[DEBUG] test message')
		})

		it('formats info messages with uppercase prefix', () => {
			expect(formatMessage('info', 'test message')).toBe('[INFO] test message')
		})

		it('formats warn messages with uppercase prefix', () => {
			expect(formatMessage('warn', 'test message')).toBe('[WARN] test message')
		})

		it('formats error messages with uppercase prefix', () => {
			expect(formatMessage('error', 'test message')).toBe('[ERROR] test message')
		})

		it('formats critical messages with CRITICAL prefix', () => {
			expect(formatMessage('critical', 'critical error')).toBe('[CRITICAL] critical error')
		})

		it('handles empty messages', () => {
			expect(formatMessage('info', '')).toBe('[INFO] ')
		})

		it('handles messages with special characters', () => {
			expect(formatMessage('debug', 'Test with "quotes" and \'apostrophes\'')).toBe(
				'[DEBUG] Test with "quotes" and \'apostrophes\''
			)
		})

		it('handles messages with newlines', () => {
			expect(formatMessage('info', 'line1\nline2')).toBe('[INFO] line1\nline2')
		})

		it('handles unicode characters', () => {
			expect(formatMessage('info', 'Hello 世界 🌍')).toBe('[INFO] Hello 世界 🌍')
		})

		it('handles very long messages', () => {
			const longMessage = 'a'.repeat(1000)
			expect(formatMessage('info', longMessage)).toBe(`[INFO] ${longMessage}`)
		})
	})

	describe('shouldLog', () => {
		it('returns false for debug level (default log level is info)', () => {
			expect(shouldLog('debug')).toBe(false)
		})

		it('returns true for info level and above with default log level', () => {
			expect(shouldLog('info')).toBe(true)
			expect(shouldLog('warn')).toBe(true)
			expect(shouldLog('error')).toBe(true)
			expect(shouldLog('critical')).toBe(true)
		})
	})

	describe('logger object', () => {
		let consoleDebugSpy: any
		let consoleInfoSpy: any
		let consoleWarnSpy: any
		let consoleErrorSpy: any

		beforeEach(() => {
			vi.clearAllMocks()
			consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
			consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
			consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
			consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		})

		it('logger.debug does not call console.debug at default log level', () => {
			logger.debug('test message')
			expect(consoleDebugSpy).not.toHaveBeenCalled()
		})

		it('logger.info calls console.info with default log level', () => {
			logger.info('test message')
			expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO] test message', '')
		})

		it('logger.info calls console.info with provided meta', () => {
			logger.info('test message', { key: 'value' })
			expect(consoleInfoSpy).toHaveBeenCalledWith(
				'[INFO] test message',
				expect.objectContaining({ key: 'value' })
			)
		})

		it('logger.warn calls console.warn with default log level', () => {
			logger.warn('test message')
			expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] test message', '')
		})

		it('logger.error calls console.error with default log level', () => {
			logger.error('test message')
			expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] test message', '')
		})

		it('logger.critical calls console.error with CRITICAL prefix', () => {
			logger.critical('critical error')
			expect(consoleErrorSpy).toHaveBeenCalledWith('[CRITICAL] critical error', '')
		})

		it('logger methods handle undefined meta gracefully', () => {
			logger.info('test message', undefined as any)
			expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO] test message', '')
		})

		it('logger methods handle null meta gracefully', () => {
			logger.info('test message', null as any)
			expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO] test message', '')
		})

		it('logger methods handle complex meta objects', () => {
			const complexMeta = {
				nested: { value: 123 },
				array: [1, 2, 3],
				string: 'test',
			}
			logger.info('complex message', complexMeta)
			expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO] complex message', complexMeta)
		})

		it('logger.info handles multiple calls', () => {
			logger.info('message 1')
			logger.info('message 2')
			logger.info('message 3')
			expect(consoleInfoSpy).toHaveBeenCalledTimes(3)
			expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO] message 1', '')
			expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO] message 2', '')
			expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO] message 3', '')
		})

		it('logger methods do not interfere with each other', () => {
			logger.info('info message')
			logger.warn('warn message')
			logger.error('error message')

			expect(consoleInfoSpy).toHaveBeenCalledTimes(1)
			expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
			expect(consoleErrorSpy).toHaveBeenCalledTimes(1)

			expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO] info message', '')
			expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] warn message', '')
			expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] error message', '')
		})

		it('logger handles error objects in meta', () => {
			const error = new Error('test error')
			logger.error('error message', { error })
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'[ERROR] error message',
				expect.objectContaining({ error })
			)
		})

		it('logger handles Date objects in meta', () => {
			const date = new Date('2024-01-01')
			logger.info('info message', { date })
			expect(consoleInfoSpy).toHaveBeenCalledWith(
				'[INFO] info message',
				expect.objectContaining({ date })
			)
		})

		it('logger handles boolean and number values in meta', () => {
			logger.info('info message', { count: 42, active: true })
			expect(consoleInfoSpy).toHaveBeenCalledWith(
				'[INFO] info message',
				expect.objectContaining({ count: 42, active: true })
			)
		})
	})
})
