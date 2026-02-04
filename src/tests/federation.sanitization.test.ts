import { describe, it, expect } from 'vitest'
import { sanitizeHtml, sanitizeText } from '../lib/sanitization.js'
import { extractEventProperties } from '../federation.js'

describe('Federation Sanitization', () => {
	describe('sanitizeHtml', () => {
		it('should strip script tags', () => {
			const input = '<p>Hello</p><script>alert("XSS")</script>'
			const output = sanitizeHtml(input)
			expect(output).toBe('<p>Hello</p>')
		})

		it('should strip iframe tags', () => {
			const input = '<div><iframe src="javascript:alert(1)"></iframe></div>'
			const output = sanitizeHtml(input)
			expect(output).toBe('<div></div>')
		})

		it('should strip dangerous attributes', () => {
			const input = '<a href="javascript:alert(1)" onclick="alert(1)">Link</a>'
			const output = sanitizeHtml(input)
			expect(output).toBe('<a>Link</a>')
		})

		it('should allow safe tags and attributes', () => {
			const input = '<p><strong>Bold</strong> and <a href="https://example.com" title="Example">Link</a></p>'
			const output = sanitizeHtml(input)
			// Note: DOMPurify might reorder attributes or change quoting, but the structure should be preserved
			expect(output).toContain('<p>')
			expect(output).toContain('<strong>Bold</strong>')
			expect(output).toContain('<a')
			expect(output).toContain('href="https://example.com"')
			expect(output).toContain('title="Example"')
		})

		it('should add target="_blank" and rel="noopener noreferrer" to external links', () => {
			const input = '<a href="https://example.com">External</a>'
			const output = sanitizeHtml(input)
			expect(output).toContain('target="_blank"')
			expect(output).toContain('rel="noopener noreferrer"')
		})
	})

	describe('sanitizeText', () => {
		it('should strip all HTML tags', () => {
			const input = '<p>Hello <strong>World</strong></p>'
			const output = sanitizeText(input)
			expect(output).toBe('Hello World')
		})
	})

	describe('extractEventProperties', () => {
		it('should sanitize event name (text)', () => {
			const event = {
				id: 'https://example.com/events/1',
				name: '<b>Event Name</b>',
				summary: 'Summary',
				content: 'Content',
				startTime: '2023-01-01T00:00:00Z',
			}
			const props = extractEventProperties(event)
			expect(props.eventName).toBe('Event Name')
		})

		it('should sanitize event summary (html)', () => {
			const event = {
				id: 'https://example.com/events/1',
				name: 'Event',
				summary: '<p>Summary <script>alert(1)</script></p>',
				content: 'Content',
				startTime: '2023-01-01T00:00:00Z',
			}
			const props = extractEventProperties(event)
			expect(props.eventSummary).toBe('<p>Summary </p>')
		})

		it('should sanitize event content (html)', () => {
			const event = {
				id: 'https://example.com/events/1',
				name: 'Event',
				summary: 'Summary',
				content: '<div onclick="alert(1)">Content</div>',
				startTime: '2023-01-01T00:00:00Z',
			}
			const props = extractEventProperties(event)
			expect(props.eventContent).toBe('<div>Content</div>')
		})

		it('should sanitize location name (text)', () => {
			const event = {
				id: 'https://example.com/events/1',
				name: 'Event',
				location: {
					name: '<i>Location</i>',
				},
				startTime: '2023-01-01T00:00:00Z',
			}
			const props = extractEventProperties(event)
			expect(props.locationValue).toBe('Location')
		})

		it('should sanitize attributedTo (text)', () => {
			const event = {
				id: 'https://example.com/events/1',
				name: 'Event',
				startTime: '2023-01-01T00:00:00Z',
				attributedTo: '<a href="evil.com">User</a>',
			}
			const props = extractEventProperties(event)
			expect(props.attributedTo).toBe('User')
		})
	})
})
