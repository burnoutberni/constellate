import { describe, it, expect } from 'vitest'
import { extractEventProperties } from '../federation.js'

describe('Federation Sanitization', () => {
	describe('extractEventProperties', () => {
		it('sanitizes eventName (plain text)', () => {
			const input = {
				id: 'test',
				name: '<b>Event Name</b>',
				summary: 'Safe',
				content: 'Safe',
			}
			const result = extractEventProperties(input)
			expect(result.eventName).toBe('Event Name')
		})

		it('sanitizes eventSummary (HTML)', () => {
			const input = {
				id: 'test',
				name: 'Event',
				summary: '<p>Summary <script>alert(1)</script></p>',
				content: 'Safe',
			}
			const result = extractEventProperties(input)
			expect(result.eventSummary).toBe('<p>Summary </p>')
		})

		it('sanitizes eventContent (HTML)', () => {
			const input = {
				id: 'test',
				name: 'Event',
				summary: 'Safe',
				content: '<p>Content <script>alert(1)</script></p>',
			}
			const result = extractEventProperties(input)
			expect(result.eventContent).toBe('<p>Content </p>')
		})

		it('handles null/undefined fields', () => {
			const input = {
				id: 'test',
			}
			const result = extractEventProperties(input)
			expect(result.eventName).toBe('')
			expect(result.eventSummary).toBeNull()
			expect(result.eventContent).toBeNull()
		})
	})
})
