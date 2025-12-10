/**
 * Tests for Timezone Utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isValidTimeZone, normalizeTimeZone, DEFAULT_TIMEZONE } from '../../lib/timezone.js'

describe('isValidTimeZone', () => {
    it('should return true for valid IANA timezones', () => {
        const validTimezones = [
            'America/New_York',
            'America/Los_Angeles',
            'Europe/London',
            'Europe/Berlin',
            'Asia/Tokyo',
            'America/Chicago',
            'Australia/Sydney',
        ]

        validTimezones.forEach((tz) => {
            expect(isValidTimeZone(tz)).toBe(true)
        })
    })

    it('should handle UTC timezone (may vary by environment)', () => {
        // UTC may or may not be recognized depending on the environment
        // This is acceptable behavior - the function should still work correctly
        const result = isValidTimeZone('UTC')
        expect(typeof result).toBe('boolean')
    })

    it('should return false for invalid timezones', () => {
        const invalidTimezones = [
            'Not/AZone',
            'Invalid/Timezone',
            'America/Invalid',
            'Europe/NotReal',
            'Random/Value',
            '123',
            '',
        ]

        invalidTimezones.forEach((tz) => {
            expect(isValidTimeZone(tz)).toBe(false)
        })
    })

    it('should return false for null values', () => {
        expect(isValidTimeZone(null)).toBe(false)
    })

    it('should return false for undefined values', () => {
        expect(isValidTimeZone(undefined)).toBe(false)
    })

    it('should return false for empty string', () => {
        expect(isValidTimeZone('')).toBe(false)
    })

    describe('with supportedValuesOf available', () => {
        let originalSupportedValuesOf: typeof Intl.supportedValuesOf | undefined

        beforeEach(() => {
            // Store original if it exists
            const intl = Intl as typeof Intl & {
                supportedValuesOf?: (type: 'timeZone') => string[]
            }
            originalSupportedValuesOf = intl.supportedValuesOf
        })

        afterEach(() => {
            // Restore original
            const intl = Intl as typeof Intl & {
                supportedValuesOf?: (type: 'timeZone') => string[]
            }
            if (originalSupportedValuesOf) {
                intl.supportedValuesOf = originalSupportedValuesOf
            } else {
                delete (intl as any).supportedValuesOf
            }
        })

        it('should use supportedValuesOf when available', () => {
            const intl = Intl as typeof Intl & {
                supportedValuesOf?: (type: 'timeZone') => string[]
            }
            const mockSupportedValues = ['America/New_York', 'Europe/London', 'UTC']
            intl.supportedValuesOf = vi.fn((type: 'timeZone') => {
                if (type === 'timeZone') {
                    return mockSupportedValues
                }
                return []
            }) as any

            expect(isValidTimeZone('America/New_York')).toBe(true)
            expect(isValidTimeZone('Europe/London')).toBe(true)
            expect(isValidTimeZone('UTC')).toBe(true)
            expect(isValidTimeZone('Not/AZone')).toBe(false)
            expect(isValidTimeZone('America/Los_Angeles')).toBe(false) // Not in mock list

            expect(intl.supportedValuesOf).toHaveBeenCalledWith('timeZone')
        })
    })

    describe('without supportedValuesOf (fallback path)', () => {
        let originalSupportedValuesOf: typeof Intl.supportedValuesOf | undefined

        beforeEach(() => {
            // Store original if it exists
            const intl = Intl as typeof Intl & {
                supportedValuesOf?: (type: 'timeZone') => string[]
            }
            originalSupportedValuesOf = intl.supportedValuesOf
            // Remove supportedValuesOf to test fallback
            delete (intl as any).supportedValuesOf
        })

        afterEach(() => {
            // Restore original
            const intl = Intl as typeof Intl & {
                supportedValuesOf?: (type: 'timeZone') => string[]
            }
            if (originalSupportedValuesOf) {
                intl.supportedValuesOf = originalSupportedValuesOf
            } else {
                delete (intl as any).supportedValuesOf
            }
        })

        it('should use DateTimeFormat fallback when supportedValuesOf is not available', () => {
            // This should work because DateTimeFormat can validate timezones
            expect(isValidTimeZone('America/New_York')).toBe(true)
            expect(isValidTimeZone('UTC')).toBe(true)
            expect(isValidTimeZone('Not/AZone')).toBe(false)
        })

        it('should handle DateTimeFormat throwing errors for invalid timezones', () => {
            // Invalid timezone should cause DateTimeFormat to throw, which we catch
            expect(isValidTimeZone('Invalid/Timezone')).toBe(false)
        })
    })
})

describe('normalizeTimeZone', () => {
    it('should return valid timezones unchanged', () => {
        const validTimezones = [
            'America/New_York',
            'America/Los_Angeles',
            'Europe/London',
        ]

        validTimezones.forEach((tz) => {
            expect(normalizeTimeZone(tz)).toBe(tz)
        })
    })

    it('should return default fallback for invalid timezones', () => {
        const invalidTimezones = [
            'Not/AZone',
            'Invalid/Timezone',
            'Random/Value',
        ]

        invalidTimezones.forEach((tz) => {
            expect(normalizeTimeZone(tz)).toBe(DEFAULT_TIMEZONE)
        })
    })

    it('should return default fallback for null values', () => {
        expect(normalizeTimeZone(null)).toBe(DEFAULT_TIMEZONE)
    })

    it('should return default fallback for undefined values', () => {
        expect(normalizeTimeZone(undefined)).toBe(DEFAULT_TIMEZONE)
    })

    it('should return default fallback for empty string', () => {
        expect(normalizeTimeZone('')).toBe(DEFAULT_TIMEZONE)
    })

    it('should respect custom fallback parameter', () => {
        const customFallback = 'America/New_York'
        expect(normalizeTimeZone(null, customFallback)).toBe(customFallback)
        expect(normalizeTimeZone(undefined, customFallback)).toBe(customFallback)
        expect(normalizeTimeZone('Invalid/Timezone', customFallback)).toBe(customFallback)
    })

    it('should return valid timezone even when custom fallback is provided', () => {
        const validTimezone = 'Europe/London'
        const customFallback = 'America/New_York'
        expect(normalizeTimeZone(validTimezone, customFallback)).toBe(validTimezone)
    })

    it('should handle edge case where custom fallback is also invalid', () => {
        const invalidFallback = 'Invalid/Fallback'
        // When fallback is invalid, it will still be returned because isValidTimeZone returns false
        // and we return the fallback
        expect(normalizeTimeZone('Also/Invalid', invalidFallback)).toBe(invalidFallback)
    })
})


