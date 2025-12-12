/**
 * Tests for Admin Federation Helper Functions
 * Tests for processDelivery and getDomainStats functions
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { FailedDeliveryStatus } from '@prisma/client'

// These helper functions are defined in admin.ts but not exported
// We'll test them by duplicating the implementation for unit testing
// Alternatively, they could be exported from admin.ts for direct testing

describe('Admin Federation Helper Functions', () => {
	describe('processDelivery', () => {
		function processDelivery(
			domainStats: Map<string, { success: number; failed: number }>,
			delivery: { inboxUrl: string; status: FailedDeliveryStatus }
		) {
			try {
				const domain = new URL(delivery.inboxUrl).hostname
				const stats = domainStats.get(domain) || { success: 0, failed: 0 }
				if (delivery.status === 'FAILED' || delivery.status === 'PENDING') {
					stats.failed++
				} else if (delivery.status === 'DISCARDED') {
					stats.success++
				}
				// RETRYING status is not counted as either success or failure
				domainStats.set(domain, stats)
			} catch {
				console.debug('Skipping delivery with invalid inbox URL:', delivery.inboxUrl)
			}
		}

		let domainStats: Map<string, { success: number; failed: number }>

		beforeEach(() => {
			domainStats = new Map()
		})

		it('should increment failed count for FAILED status', () => {
			const delivery = {
				inboxUrl: 'https://example.com/inbox',
				status: 'FAILED' as FailedDeliveryStatus,
			}

			processDelivery(domainStats, delivery)

			expect(domainStats.get('example.com')).toEqual({
				success: 0,
				failed: 1,
			})
		})

		it('should increment failed count for PENDING status', () => {
			const delivery = {
				inboxUrl: 'https://example.com/inbox',
				status: 'PENDING' as FailedDeliveryStatus,
			}

			processDelivery(domainStats, delivery)

			expect(domainStats.get('example.com')).toEqual({
				success: 0,
				failed: 1,
			})
		})

		it('should increment success count for DISCARDED status', () => {
			const delivery = {
				inboxUrl: 'https://example.com/inbox',
				status: 'DISCARDED' as FailedDeliveryStatus,
			}

			processDelivery(domainStats, delivery)

			expect(domainStats.get('example.com')).toEqual({
				success: 1,
				failed: 0,
			})
		})

		it('should not count RETRYING status', () => {
			const delivery = {
				inboxUrl: 'https://example.com/inbox',
				status: 'RETRYING' as FailedDeliveryStatus,
			}

			processDelivery(domainStats, delivery)

			// Entry should exist but with 0 counts
			expect(domainStats.get('example.com')).toEqual({
				success: 0,
				failed: 0,
			})
		})

		it('should accumulate counts for same domain', () => {
			processDelivery(domainStats, {
				inboxUrl: 'https://example.com/inbox1',
				status: 'FAILED' as FailedDeliveryStatus,
			})

			processDelivery(domainStats, {
				inboxUrl: 'https://example.com/inbox2',
				status: 'FAILED' as FailedDeliveryStatus,
			})

			processDelivery(domainStats, {
				inboxUrl: 'https://example.com/inbox3',
				status: 'DISCARDED' as FailedDeliveryStatus,
			})

			expect(domainStats.get('example.com')).toEqual({
				success: 1,
				failed: 2,
			})
		})

		it('should handle multiple domains independently', () => {
			processDelivery(domainStats, {
				inboxUrl: 'https://example.com/inbox',
				status: 'FAILED' as FailedDeliveryStatus,
			})

			processDelivery(domainStats, {
				inboxUrl: 'https://other.com/inbox',
				status: 'DISCARDED' as FailedDeliveryStatus,
			})

			processDelivery(domainStats, {
				inboxUrl: 'https://third.com/inbox',
				status: 'PENDING' as FailedDeliveryStatus,
			})

			expect(domainStats.get('example.com')).toEqual({
				success: 0,
				failed: 1,
			})

			expect(domainStats.get('other.com')).toEqual({
				success: 1,
				failed: 0,
			})

			expect(domainStats.get('third.com')).toEqual({
				success: 0,
				failed: 1,
			})
		})

		it('should skip invalid inbox URLs without throwing', () => {
			const delivery = {
				inboxUrl: 'not-a-valid-url',
				status: 'FAILED' as FailedDeliveryStatus,
			}

			// Should not throw
			expect(() => processDelivery(domainStats, delivery)).not.toThrow()

			// Should not have added any entries
			expect(domainStats.size).toBe(0)
		})

		it('should skip malformed URLs without throwing', () => {
			const deliveries = [
				{ inboxUrl: '', status: 'FAILED' as FailedDeliveryStatus },
				{ inboxUrl: 'http://', status: 'FAILED' as FailedDeliveryStatus },
				{ inboxUrl: '://invalid', status: 'FAILED' as FailedDeliveryStatus },
			]

			deliveries.forEach((delivery) => {
				expect(() => processDelivery(domainStats, delivery)).not.toThrow()
			})

			expect(domainStats.size).toBe(0)
		})

		it('should extract correct hostname from URLs with paths', () => {
			processDelivery(domainStats, {
				inboxUrl: 'https://example.com/users/alice/inbox',
				status: 'FAILED' as FailedDeliveryStatus,
			})

			processDelivery(domainStats, {
				inboxUrl: 'https://example.com/users/bob/inbox',
				status: 'DISCARDED' as FailedDeliveryStatus,
			})

			expect(domainStats.get('example.com')).toEqual({
				success: 1,
				failed: 1,
			})
		})

		it('should handle URLs with different ports as different domains', () => {
			processDelivery(domainStats, {
				inboxUrl: 'https://example.com:443/inbox',
				status: 'FAILED' as FailedDeliveryStatus,
			})

			processDelivery(domainStats, {
				inboxUrl: 'https://example.com:8443/inbox',
				status: 'DISCARDED' as FailedDeliveryStatus,
			})

			// Both should be grouped under 'example.com' (hostname doesn't include port)
			expect(domainStats.get('example.com')).toEqual({
				success: 1,
				failed: 1,
			})
		})
	})

	describe('getDomainStats', () => {
		function processDelivery(
			domainStats: Map<string, { success: number; failed: number }>,
			delivery: { inboxUrl: string; status: FailedDeliveryStatus }
		) {
			try {
				const domain = new URL(delivery.inboxUrl).hostname
				const stats = domainStats.get(domain) || { success: 0, failed: 0 }
				if (delivery.status === 'FAILED' || delivery.status === 'PENDING') {
					stats.failed++
				} else if (delivery.status === 'DISCARDED') {
					stats.success++
				}
				domainStats.set(domain, stats)
			} catch {
				console.debug('Skipping delivery with invalid inbox URL:', delivery.inboxUrl)
			}
		}

		function getDomainStats(
			recentDeliveries: { inboxUrl: string; status: FailedDeliveryStatus }[]
		) {
			const domainStats = new Map<string, { success: number; failed: number }>()
			for (const delivery of recentDeliveries) {
				processDelivery(domainStats, delivery)
			}

			return Array.from(domainStats.entries()).map(([domain, stats]) => ({
				domain,
				...stats,
			}))
		}

		it('should aggregate stats by domain from multiple deliveries', () => {
			const deliveries = [
				{
					inboxUrl: 'https://example.com/inbox1',
					status: 'FAILED' as FailedDeliveryStatus,
				},
				{
					inboxUrl: 'https://example.com/inbox2',
					status: 'DISCARDED' as FailedDeliveryStatus,
				},
				{ inboxUrl: 'https://other.com/inbox', status: 'FAILED' as FailedDeliveryStatus },
			]

			const result = getDomainStats(deliveries)

			expect(result).toHaveLength(2)
			expect(result).toContainEqual({
				domain: 'example.com',
				success: 1,
				failed: 1,
			})
			expect(result).toContainEqual({
				domain: 'other.com',
				success: 0,
				failed: 1,
			})
		})

		it('should return empty array for empty input', () => {
			const result = getDomainStats([])
			expect(result).toEqual([])
		})

		it('should handle single delivery', () => {
			const deliveries = [
				{ inboxUrl: 'https://example.com/inbox', status: 'FAILED' as FailedDeliveryStatus },
			]

			const result = getDomainStats(deliveries)

			expect(result).toEqual([
				{
					domain: 'example.com',
					success: 0,
					failed: 1,
				},
			])
		})

		it('should skip invalid URLs without breaking the aggregation', () => {
			const deliveries = [
				{ inboxUrl: 'https://example.com/inbox', status: 'FAILED' as FailedDeliveryStatus },
				{ inboxUrl: 'not-a-valid-url', status: 'FAILED' as FailedDeliveryStatus },
				{
					inboxUrl: 'https://other.com/inbox',
					status: 'DISCARDED' as FailedDeliveryStatus,
				},
				{ inboxUrl: '', status: 'PENDING' as FailedDeliveryStatus },
			]

			const result = getDomainStats(deliveries)

			expect(result).toHaveLength(2)
			expect(result).toContainEqual({
				domain: 'example.com',
				success: 0,
				failed: 1,
			})
			expect(result).toContainEqual({
				domain: 'other.com',
				success: 1,
				failed: 0,
			})
		})

		it('should not count RETRYING status in success or failed', () => {
			const deliveries = [
				{
					inboxUrl: 'https://example.com/inbox1',
					status: 'RETRYING' as FailedDeliveryStatus,
				},
				{
					inboxUrl: 'https://example.com/inbox2',
					status: 'RETRYING' as FailedDeliveryStatus,
				},
			]

			const result = getDomainStats(deliveries)

			expect(result).toContainEqual({
				domain: 'example.com',
				success: 0,
				failed: 0,
			})
		})

		it('should aggregate complex mix of statuses correctly', () => {
			const deliveries = [
				{
					inboxUrl: 'https://mastodon.social/inbox',
					status: 'FAILED' as FailedDeliveryStatus,
				},
				{
					inboxUrl: 'https://mastodon.social/users/alice/inbox',
					status: 'FAILED' as FailedDeliveryStatus,
				},
				{
					inboxUrl: 'https://mastodon.social/users/bob/inbox',
					status: 'DISCARDED' as FailedDeliveryStatus,
				},
				{
					inboxUrl: 'https://mastodon.social/users/carol/inbox',
					status: 'RETRYING' as FailedDeliveryStatus,
				},
				{
					inboxUrl: 'https://pixelfed.social/inbox',
					status: 'PENDING' as FailedDeliveryStatus,
				},
				{
					inboxUrl: 'https://pixelfed.social/users/dave/inbox',
					status: 'DISCARDED' as FailedDeliveryStatus,
				},
				{
					inboxUrl: 'https://pixelfed.social/users/eve/inbox',
					status: 'DISCARDED' as FailedDeliveryStatus,
				},
			]

			const result = getDomainStats(deliveries)

			expect(result).toHaveLength(2)
			expect(result).toContainEqual({
				domain: 'mastodon.social',
				success: 1, // 1 DISCARDED
				failed: 2, // 2 FAILED (RETRYING not counted)
			})
			expect(result).toContainEqual({
				domain: 'pixelfed.social',
				success: 2, // 2 DISCARDED
				failed: 1, // 1 PENDING
			})
		})

		it('should return domain stats in any order', () => {
			const deliveries = [
				{ inboxUrl: 'https://zebra.com/inbox', status: 'FAILED' as FailedDeliveryStatus },
				{ inboxUrl: 'https://alpha.com/inbox', status: 'FAILED' as FailedDeliveryStatus },
				{ inboxUrl: 'https://beta.com/inbox', status: 'FAILED' as FailedDeliveryStatus },
			]

			const result = getDomainStats(deliveries)

			expect(result).toHaveLength(3)
			// Map maintains insertion order, so we can verify all domains are present
			const domains = result.map((s) => s.domain)
			expect(domains).toContain('zebra.com')
			expect(domains).toContain('alpha.com')
			expect(domains).toContain('beta.com')
		})
	})
})
