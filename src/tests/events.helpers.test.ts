import { describe, it, expect } from 'vitest'
import {
	normalizeRecipients,
	buildAddressingFromActivity,
	getBroadcastTarget,
	transformEventsForClient,
} from '../events.js'

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

	describe('transformEventsForClient', () => {
		it('ensures _count is populated when missing', () => {
			const events = [{ id: '1' }] as any
			const result = transformEventsForClient(events)
			expect(result[0]._count).toEqual({ attendance: 0, likes: 0, comments: 0 })
		})

		it('preserves existing _count', () => {
			const events = [{ id: '1', _count: { attendance: 5, likes: 2, comments: 1 } }] as any
			const result = transformEventsForClient(events)
			expect(result[0]._count).toEqual({ attendance: 5, likes: 2, comments: 1 })
		})

		it('derives viewerStatus from attendance', () => {
			const events = [
				{
					id: '1',
					attendance: [{ userId: 'user1', status: 'attending' }],
				},
			] as any
			const result = transformEventsForClient(events, 'user1')
			expect(result[0].viewerStatus).toBe('attending')
		})

		it('returns null viewerStatus if user not in attendance', () => {
			const events = [
				{
					id: '1',
					attendance: [{ userId: 'user2', status: 'attending' }],
				},
			] as any
			const result = transformEventsForClient(events, 'user1')
			expect(result[0].viewerStatus).toBeNull()
		})

		it('preserves existing viewerStatus if present', () => {
			const events = [
				{
					id: '1',
					viewerStatus: 'maybe',
					attendance: [{ userId: 'user1', status: 'attending' }],
				},
			] as any
			// Even if attendance says 'attending', if 'viewerStatus' is already set, it should keep it
			// (Assuming the function prefers existing prop as per implementation: (event ...).viewerStatus ?? derived)
			const result = transformEventsForClient(events, 'user1')
			expect(result[0].viewerStatus).toBe('maybe')
		})
	})
})
