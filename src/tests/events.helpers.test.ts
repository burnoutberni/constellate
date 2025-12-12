import { describe, it, expect } from 'vitest'
import { normalizeRecipients, buildAddressingFromActivity, getBroadcastTarget } from '../events.js'

describe('events helper utilities', () => {
	describe('normalizeRecipients', () => {
		it('returns empty array when value is undefined', () => {
			expect(normalizeRecipients()).toEqual([])
		})

		it('wraps single string values into an array', () => {
			expect(normalizeRecipients('https://example.com')).toEqual(['https://example.com'])
		})

		it('returns the same array instance when already an array', () => {
			const recipients = ['https://example.com/a', 'https://example.com/b']
			expect(normalizeRecipients(recipients)).toBe(recipients)
		})
	})

	describe('buildAddressingFromActivity', () => {
		it('normalizes string recipients into arrays', () => {
			const addressing = buildAddressingFromActivity({
				to: 'https://example.com/to',
				cc: 'https://example.com/cc',
			})

			expect(addressing).toEqual({
				to: ['https://example.com/to'],
				cc: ['https://example.com/cc'],
				bcc: [],
			})
		})

		it('handles missing to/cc fields gracefully', () => {
			const addressing = buildAddressingFromActivity({})
			expect(addressing).toEqual({ to: [], cc: [], bcc: [] })
		})

		it('preserves existing arrays without cloning', () => {
			const to = ['https://example.com/a']
			const cc = ['https://example.com/b']
			const addressing = buildAddressingFromActivity({ to, cc })

			expect(addressing.to).toBe(to)
			expect(addressing.cc).toBe(cc)
		})
	})

	describe('getBroadcastTarget', () => {
		it('returns undefined for public events', () => {
			expect(getBroadcastTarget('PUBLIC', 'owner')).toBeUndefined()
		})

		it('returns undefined for follower-only events to broadcast widely', () => {
			expect(getBroadcastTarget('FOLLOWERS', 'owner')).toBeUndefined()
		})

		it('returns owner id for private and unlisted events', () => {
			expect(getBroadcastTarget('PRIVATE', 'owner')).toBe('owner')
			expect(getBroadcastTarget('UNLISTED', 'owner')).toBe('owner')
		})

		it('defaults to public when visibility is missing', () => {
			expect(getBroadcastTarget(undefined, 'owner')).toBeUndefined()
		})
	})
})
