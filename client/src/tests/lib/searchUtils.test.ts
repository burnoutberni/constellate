import { describe, it, expect } from 'vitest'
import {
	parseCommaList,
	isoToInputDate,
	inputDateToISO,
	isBackendDateRange,
	formatDateLabel,
	normalizeCategory,
} from '../../lib/searchUtils'

describe('searchUtils', () => {
	describe('parseCommaList', () => {
		it('should parse comma-separated string into array', () => {
			expect(parseCommaList('tag1,tag2,tag3')).toEqual(['tag1', 'tag2', 'tag3'])
		})

		it('should trim whitespace from items', () => {
			expect(parseCommaList('tag1 , tag2 , tag3')).toEqual(['tag1', 'tag2', 'tag3'])
		})

		it('should filter out empty items', () => {
			expect(parseCommaList('tag1,,tag2,  ,tag3')).toEqual(['tag1', 'tag2', 'tag3'])
		})

		it('should return empty array for null or undefined', () => {
			expect(parseCommaList(null)).toEqual([])
			expect(parseCommaList(undefined)).toEqual([])
			expect(parseCommaList('')).toEqual([])
		})
	})

	describe('isoToInputDate', () => {
		it('should convert ISO date to input format', () => {
			expect(isoToInputDate('2024-01-15T10:00:00Z')).toBe('2024-01-15')
		})

		it('should return empty string for invalid date', () => {
			expect(isoToInputDate('invalid')).toBe('')
		})

		it('should return empty string for null or undefined', () => {
			expect(isoToInputDate(null)).toBe('')
			expect(isoToInputDate(undefined)).toBe('')
		})
	})

	describe('inputDateToISO', () => {
		it('should convert input date to ISO format', () => {
			const result = inputDateToISO('2024-01-15')
			expect(result).toBe('2024-01-15T00:00:00.000Z')
		})

		it('should convert to end of day when specified', () => {
			const result = inputDateToISO('2024-01-15', true)
			expect(result).toBe('2024-01-15T23:59:59.999Z')
		})

		it('should return undefined for invalid date', () => {
			expect(inputDateToISO('invalid')).toBeUndefined()
			expect(inputDateToISO('')).toBeUndefined()
		})
	})

	describe('isBackendDateRange', () => {
		it('should return true for valid backend date ranges', () => {
			expect(isBackendDateRange('today')).toBe(true)
			expect(isBackendDateRange('tomorrow')).toBe(true)
			expect(isBackendDateRange('this_weekend')).toBe(true)
			expect(isBackendDateRange('next_7_days')).toBe(true)
			expect(isBackendDateRange('next_30_days')).toBe(true)
		})

		it('should return false for invalid date ranges', () => {
			expect(isBackendDateRange('invalid')).toBe(false)
			expect(isBackendDateRange('anytime')).toBe(false)
			expect(isBackendDateRange('custom')).toBe(false)
		})
	})

	describe('formatDateLabel', () => {
		it('should format ISO date to localized string', () => {
			const result = formatDateLabel('2024-01-15T10:00:00Z')
			// Format will vary by locale, but should contain month and day
			expect(result).toMatch(/Jan|15|2024/)
		})

		it('should return original string for invalid date', () => {
			expect(formatDateLabel('invalid')).toBe('invalid')
		})
	})

	describe('normalizeCategory', () => {
		it('should trim whitespace', () => {
			expect(normalizeCategory('  test  ')).toBe('test')
		})

		it('should remove leading # symbols', () => {
			expect(normalizeCategory('#test')).toBe('test')
			expect(normalizeCategory('##test')).toBe('test')
			expect(normalizeCategory('###test')).toBe('test')
		})

		it('should convert to lowercase', () => {
			expect(normalizeCategory('TEST')).toBe('test')
			expect(normalizeCategory('Test')).toBe('test')
		})

		it('should handle combination of operations', () => {
			expect(normalizeCategory('  #TEST  ')).toBe('test')
			expect(normalizeCategory('##Category Name')).toBe('category name')
		})
	})
})
