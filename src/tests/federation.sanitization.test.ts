import { describe, it, expect } from 'vitest'
import { sanitizeHtml, sanitizeText } from '../lib/sanitization.js'
import { extractEventProperties } from '../federation.js'

describe('Sanitization', () => {
	describe('sanitizeHtml', () => {
		it('should strip script tags', () => {
			const input = '<script>alert("xss")</script><p>Hello</p>'
			expect(sanitizeHtml(input)).toBe('<p>Hello</p>')
		})

		it('should strip onclick attributes', () => {
			const input = '<a href="/test" onclick="alert(1)">Click me</a>'
			expect(sanitizeHtml(input)).toBe('<a href="/test">Click me</a>')
		})

		it('should preserve safe tags and attributes', () => {
			const input =
				'<p><strong>Bold</strong> and <a href="https://example.com" title="Example">Link</a></p>'
			// Expect target="_blank" because of the hook
			expect(sanitizeHtml(input)).toContain('target="_blank"')
			expect(sanitizeHtml(input)).toContain('rel="noopener noreferrer"')
			expect(sanitizeHtml(input)).toContain('href="https://example.com"')
			expect(sanitizeHtml(input)).toContain('title="Example"')
		})

		it('should add target="_blank" to external links', () => {
			const input = '<a href="https://google.com">Google</a>'
			const output = sanitizeHtml(input)
			expect(output).toContain('target="_blank"')
			expect(output).toContain('rel="noopener noreferrer"')
		})

		it('should not add target="_blank" to internal links', () => {
			// This depends on EXTERNAL_URL_REGEX logic.
			// Currently it matches http://, https://, //.
			// So relative links shouldn't match.
			const input = '<a href="/local/path">Local</a>'
			const output = sanitizeHtml(input)
			expect(output).not.toContain('target="_blank"')
			expect(output).toBe('<a href="/local/path">Local</a>')
		})
	})

	describe('sanitizeText', () => {
		it('should strip all HTML tags', () => {
			const input = '<h1>Title</h1><script>alert(1)</script>'
			expect(sanitizeText(input)).toBe('Title')
		})
	})

	describe('extractEventProperties', () => {
		it('should sanitize event name (title)', () => {
			const event = {
				id: 'https://example.com/events/1',
				name: '<h1>Dangerous Title</h1>',
				type: 'Event',
			}
			const props = extractEventProperties(event)
			expect(props.eventName).toBe('Dangerous Title')
		})

		it('should sanitize event summary (HTML allowed but safe)', () => {
			const event = {
				id: 'https://example.com/events/1',
				summary: '<p>Safe</p><script>Unsafe</script>',
				type: 'Event',
			}
			const props = extractEventProperties(event)
			expect(props.eventSummary).toBe('<p>Safe</p>')
		})

		it('should sanitize event content (HTML allowed but safe)', () => {
			const event = {
				id: 'https://example.com/events/1',
				content: '<p>Safe</p><script>Unsafe</script>',
				type: 'Event',
			}
			const props = extractEventProperties(event)
			expect(props.eventContent).toBe('<p>Safe</p>')
		})

		it('should sanitize location value', () => {
			const event = {
				id: 'https://example.com/events/1',
				location: '<b>Bold Location</b>',
				type: 'Event',
			}
			const props = extractEventProperties(event)
			expect(props.locationValue).toBe('Bold Location')
		})

		it('should sanitize location object name', () => {
			const event = {
				id: 'https://example.com/events/1',
				location: {
					type: 'Place',
					name: '<script>alert(1)</script>Park',
				},
				type: 'Event',
			}
			const props = extractEventProperties(event)
			expect(props.locationValue).toBe('Park')
		})
	})
})
