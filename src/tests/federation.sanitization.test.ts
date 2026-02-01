import { describe, it, expect } from 'vitest'
import { extractEventProperties } from '../federation.js'

describe('Federation Sanitization', () => {
	describe('extractEventProperties', () => {
		it('sanitizes event name', () => {
			const event = {
				id: '1',
				name: '<script>alert(1)</script>Event Name',
				startTime: '2023-01-01T12:00:00Z',
			}
			const result = extractEventProperties(event)
			expect(result.eventName).toBe('Event Name')
		})

		it('sanitizes event summary with allowed tags', () => {
			const event = {
				id: '1',
				name: 'Event',
				summary: '<p>Summary with <b>bold</b> text</p><script>alert(1)</script>',
				startTime: '2023-01-01T12:00:00Z',
			}
			const result = extractEventProperties(event)
			expect(result.eventSummary).toBe('<p>Summary with <b>bold</b> text</p>')
		})

		it('sanitizes event content', () => {
			const event = {
				id: '1',
				name: 'Event',
				content: '<a href="javascript:alert(1)">Dangerous Link</a>',
				startTime: '2023-01-01T12:00:00Z',
			}
			const result = extractEventProperties(event)
			expect(result.eventContent).toBe('<a>Dangerous Link</a>')
		})

		it('sanitizes attributedTo', () => {
			const event = {
				id: '1',
				name: 'Event',
				attributedTo: '<script>alert(1)</script>User',
				startTime: '2023-01-01T12:00:00Z',
			}
			const result = extractEventProperties(event)
			expect(result.attributedTo).toBe('User')
		})
	})
})
