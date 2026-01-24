/**
 * Security Tests for Federation Handlers
 */

import { describe, it, expect } from 'vitest'
import { extractEventProperties } from '../federation.js'

describe('Federation Security', () => {
	describe('extractEventProperties', () => {
		it('should sanitize XSS from event summary and content', () => {
			const maliciousEvent = {
				id: 'https://example.com/events/1',
				name: 'Malicious Event',
				summary: '<script>alert("XSS")</script>Safe summary',
				content: '<img src=x onerror=alert(1)>Safe content',
				startTime: '2024-01-01T00:00:00Z',
			}

			const extracted = extractEventProperties(maliciousEvent)

			// Check summary sanitization
			expect(extracted.eventSummary).not.toContain('<script>')
			expect(extracted.eventSummary).not.toContain('alert("XSS")')
			expect(extracted.eventSummary).toContain('Safe summary')

			// Check content sanitization
			expect(extracted.eventContent).not.toContain('<img src=x onerror=alert(1)>')
			expect(extracted.eventContent).not.toContain('onerror')
			expect(extracted.eventContent).toContain('Safe content')
		})

		it('should allow safe HTML tags in summary and content', () => {
			const safeEvent = {
				id: 'https://example.com/events/2',
				name: 'Safe Event',
				summary: '<p><strong>Bold</strong> summary</p>',
				content: '<ul><li>Item 1</li><li>Item 2</li></ul>',
				startTime: '2024-01-01T00:00:00Z',
			}

			const extracted = extractEventProperties(safeEvent)

			expect(extracted.eventSummary).toBe('<p><strong>Bold</strong> summary</p>')
			expect(extracted.eventContent).toBe('<ul><li>Item 1</li><li>Item 2</li></ul>')
		})

		it('should allow links with href', () => {
			const linkEvent = {
				id: 'https://example.com/events/3',
				name: 'Link Event',
				summary: '<a href="https://example.com">Link</a>',
				startTime: '2024-01-01T00:00:00Z',
			}

			const extracted = extractEventProperties(linkEvent)

			expect(extracted.eventSummary).toBe('<a href="https://example.com">Link</a>')
		})

		it('should strip dangerous attributes', () => {
			const dangerousAttrEvent = {
				id: 'https://example.com/events/4',
				name: 'Dangerous Attr Event',
				summary: '<a href="https://example.com" onclick="stealCookies()">Link</a>',
				startTime: '2024-01-01T00:00:00Z',
			}

			const extracted = extractEventProperties(dangerousAttrEvent)

			expect(extracted.eventSummary).toBe('<a href="https://example.com">Link</a>')
			expect(extracted.eventSummary).not.toContain('onclick')
		})
	})
})
