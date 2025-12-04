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
        // Only removes the first #, so ## becomes # which is not empty
        expect(result).toEqual(['music', '#concert', '##live'])
    })

    it('should handle very long tags', () => {
        const longTag = 'a'.repeat(100)
        const tags = [longTag, 'music']
        const result = normalizeTags(tags)
        expect(result).toEqual([longTag, 'music'])
    })
})
