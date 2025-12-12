/**
 * Tests for Tag Normalization Utilities
 */

import { describe, it, expect } from 'vitest'
import { normalizeTags } from '../../lib/tags.js'

describe('normalizeTags', () => {
	it('should normalize tags to lowercase', () => {
		const tags = ['MUSIC', 'ConCert', 'LIVE']
		const result = normalizeTags(tags)
		expect(result).toEqual(['music', 'concert', 'live'])
	})

	it('should remove # prefix from tags', () => {
		const tags = ['#music', '#concert', '#live']
		const result = normalizeTags(tags)
		expect(result).toEqual(['music', 'concert', 'live'])
	})

	it('should trim whitespace from tags', () => {
		const tags = ['  music  ', '  concert  ', '  live  ']
		const result = normalizeTags(tags)
		expect(result).toEqual(['music', 'concert', 'live'])
	})

	it('should remove empty strings after normalization', () => {
		const tags = ['music', '   ', '', '#', 'concert']
		const result = normalizeTags(tags)
		expect(result).toEqual(['music', 'concert'])
	})

	it('should remove duplicate tags', () => {
		const tags = ['music', 'concert', 'music', 'live', 'concert']
		const result = normalizeTags(tags)
		expect(result).toEqual(['music', 'concert', 'live'])
	})

	it('should remove duplicates after normalization', () => {
		const tags = ['MUSIC', 'music', '#music', '  music  ']
		const result = normalizeTags(tags)
		expect(result).toEqual(['music'])
	})

	it('should handle tags with only whitespace', () => {
		const tags = ['   ', '\t', '\n', 'music']
		const result = normalizeTags(tags)
		expect(result).toEqual(['music'])
	})

	it('should handle tags that become empty after normalization', () => {
		const tags = ['#', '   ', 'music']
		const result = normalizeTags(tags)
		expect(result).toEqual(['music'])
	})

	it('should filter out null values', () => {
		const tags = ['music', null as any, 'concert']
		const result = normalizeTags(tags)
		expect(result).toEqual(['music', 'concert'])
	})

	it('should filter out non-string values', () => {
		const tags = ['music', 123 as any, 'concert', true as any, {} as any]
		const result = normalizeTags(tags)
		expect(result).toEqual(['music', 'concert'])
	})

	it('should handle mixed valid and invalid tags', () => {
		const tags = ['MUSIC', '#concert', '   ', null as any, 'live', 123 as any, '#music']
		const result = normalizeTags(tags)
		expect(result).toEqual(['music', 'concert', 'live'])
	})

	it('should return empty array for empty input', () => {
		const result = normalizeTags([])
		expect(result).toEqual([])
	})

	it('should return empty array for non-array input', () => {
		const result1 = normalizeTags(null as any)
		const result2 = normalizeTags(undefined as any)
		const result3 = normalizeTags('not-an-array' as any)
		expect(result1).toEqual([])
		expect(result2).toEqual([])
		expect(result3).toEqual([])
	})

	it('should handle non-array objects separately from empty arrays', () => {
		// Test !Array.isArray branch separately
		const obj = { length: 0 }
		const result = normalizeTags(obj as any)
		expect(result).toEqual([])

		// Test empty array (tags.length === 0 branch)
		const result2 = normalizeTags([])
		expect(result2).toEqual([])
	})

	it('should handle filter conditions separately', () => {
		// Test typeof tag === 'string' branch (true)
		const result1 = normalizeTags(['music'])
		expect(result1).toEqual(['music'])

		// Test typeof tag === 'string' branch (false) - number
		const result2 = normalizeTags([123 as any, 'music'])
		expect(result2).toEqual(['music'])

		// Test tag !== null branch (false) - null
		const result3 = normalizeTags([null as any, 'music'])
		expect(result3).toEqual(['music'])

		// Test both conditions false
		const result4 = normalizeTags([null as any, 123 as any, 'music'])
		expect(result4).toEqual(['music'])
	})

	it('should handle tags with special characters', () => {
		const tags = ['music-2024', 'concert_live', 'event.2024']
		const result = normalizeTags(tags)
		expect(result).toEqual(['music-2024', 'concert_live', 'event.2024'])
	})

	it('should handle tags with unicode characters', () => {
		const tags = ['música', 'концерт', '音楽']
		const result = normalizeTags(tags)
		expect(result).toEqual(['música', 'концерт', '音楽'])
	})

	it('should preserve order of first occurrence for duplicates', () => {
		const tags = ['music', 'concert', 'music', 'live', 'concert', 'festival']
		const result = normalizeTags(tags)
		expect(result).toEqual(['music', 'concert', 'live', 'festival'])
	})

	it('should handle tags with multiple # prefixes', () => {
		const tags = ['#music', '##concert', '###live']
		const result = normalizeTags(tags)
		// Removes all leading # characters
		expect(result).toEqual(['music', 'concert', 'live'])
	})

	it('should handle very long tags', () => {
		const longTag = 'a'.repeat(100)
		const tags = [longTag, 'music']
		const result = normalizeTags(tags)
		expect(result).toEqual([longTag, 'music'])
	})

	it('should handle array-like objects (not true arrays)', () => {
		// Array-like object with length property
		const arrayLike = { 0: 'music', 1: 'concert', length: 2 }
		const result = normalizeTags(arrayLike as any)
		expect(result).toEqual([])
	})

	it('should handle tags that are only # characters', () => {
		const tags = ['#', '##', '###', '####', 'music']
		const result = normalizeTags(tags)
		expect(result).toEqual(['music'])
	})

	it('should handle tags with # and whitespace combinations', () => {
		const tags = ['# ', ' #', ' # ', '## ', 'music']
		const result = normalizeTags(tags)
		// '# ' becomes '' after trim, remove #, trim again
		// ' #' becomes '' after trim, remove #, trim again
		// ' # ' becomes '' after trim, remove #, trim again
		// '## ' becomes '' after trim, remove ##, trim again
		// So we expect only 'music'
		expect(result).toEqual(['music'])
	})

	it('should not remove # characters in the middle of tags', () => {
		const tags = ['music#festival', 'concert#live', 'event#2024']
		const result = normalizeTags(tags)
		expect(result).toEqual(['music#festival', 'concert#live', 'event#2024'])
	})

	it('should handle tags with # at the end', () => {
		const tags = ['music#', 'concert##', 'live###']
		const result = normalizeTags(tags)
		expect(result).toEqual(['music#', 'concert##', 'live###'])
	})

	it('should return empty array when all tags become empty after normalization', () => {
		const tags = ['#', '##', '   ', '', '\t', '\n']
		const result = normalizeTags(tags)
		expect(result).toEqual([])
	})

	it('should handle tags with mixed # and whitespace at start', () => {
		const tags = ['# music', '##concert', '#  live', 'festival']
		const result = normalizeTags(tags)
		expect(result).toEqual(['music', 'concert', 'live', 'festival'])
	})

	it('should handle empty string tags', () => {
		const tags = ['', '', 'music', '']
		const result = normalizeTags(tags)
		expect(result).toEqual(['music'])
	})

	it('should handle tags with only # and no other characters', () => {
		const tags = ['#', '##', '###', '####', '#####']
		const result = normalizeTags(tags)
		expect(result).toEqual([])
	})

	it('should handle array with length 0', () => {
		const tags: string[] = []
		const result = normalizeTags(tags)
		expect(result).toEqual([])
	})

	it('should handle tags with # followed immediately by non-word characters', () => {
		const tags = ['#-music', '#_concert', '#.live']
		const result = normalizeTags(tags)
		expect(result).toEqual(['-music', '_concert', '.live'])
	})

	it('should handle tags that normalize to same value from different inputs', () => {
		const tags = ['#MUSIC', '##music', '###MUSIC', '  MUSIC  ']
		const result = normalizeTags(tags)
		expect(result).toEqual(['music'])
	})

	it('should handle array-like object with numeric keys', () => {
		const arrayLike = { 0: 'music', 1: 'concert', 2: 'live', length: 3 }
		const result = normalizeTags(arrayLike as any)
		// Should return empty because Array.isArray will be false
		expect(result).toEqual([])
	})

	it('should handle tags with unicode and # prefix', () => {
		const tags = ['#música', '##концерт', '###音楽']
		const result = normalizeTags(tags)
		expect(result).toEqual(['música', 'концерт', '音楽'])
	})
})
