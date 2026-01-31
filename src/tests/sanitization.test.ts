import { describe, it, expect } from 'vitest'
import { sanitizeText, sanitizeHtml } from '../lib/sanitization.js'

describe('Sanitization Utils', () => {
	describe('sanitizeText', () => {
		it('should remove all HTML tags', () => {
			const input = '<p>Hello <b>World</b></p>'
			expect(sanitizeText(input)).toBe('Hello World')
		})

		it('should handle nested tags', () => {
			const input = '<div><p>Test</p></div>'
			expect(sanitizeText(input)).toBe('Test')
		})

		it('should remove script tags and content', () => {
			// DOMPurify default behavior for script tags is to remove the tag but keep content if not configured otherwise?
			// Wait, sanitizeText uses empty allowed tags.
			// Let's verify behavior. DOMPurify.sanitize with empty allowed tags usually keeps text content.
			// But script content is usually removed by DOMPurify.
			const input = '<script>alert(1)</script>Hello'
			expect(sanitizeText(input)).toBe('Hello')
		})
	})

	describe('sanitizeHtml', () => {
		it('should allow safe tags', () => {
			const input = '<p>Hello <b>World</b></p>'
			expect(sanitizeHtml(input)).toBe('<p>Hello <b>World</b></p>')
		})

		it('should remove unsafe tags', () => {
			const input = '<p>Hello <script>alert(1)</script>World</p>'
			expect(sanitizeHtml(input)).toBe('<p>Hello World</p>')
		})

		it('should allow safe attributes', () => {
			const input = '<a href="https://example.com" title="Example">Link</a>'
			expect(sanitizeHtml(input)).toBe('<a href="https://example.com" title="Example">Link</a>')
		})

		it('should remove unsafe attributes', () => {
			const input = '<div onclick="alert(1)">Hello</div>'
			expect(sanitizeHtml(input)).toBe('<div>Hello</div>')
		})

		it('should remove javascript: links', () => {
			const input = '<a href="javascript:alert(1)">Click me</a>'
			// DOMPurify removes the href attribute if it contains javascript:
			expect(sanitizeHtml(input)).toBe('<a>Click me</a>')
		})
	})
})
