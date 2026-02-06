import { describe, it, expect } from 'vitest'
import { sanitizeHtml, sanitizeText } from '../lib/sanitization.js'

describe('Federation Sanitization', () => {
	describe('sanitizeText', () => {
		it('should strip all HTML tags', () => {
			const input = '<p>Hello <strong>World</strong></p>'
			const expected = 'Hello World'
			expect(sanitizeText(input)).toBe(expected)
		})

		it('should handle nested tags', () => {
			const input = '<div><p>Test</p></div>'
			const expected = 'Test'
			expect(sanitizeText(input)).toBe(expected)
		})

		it('should handle script tags', () => {
			const input = 'Hello <script>alert("xss")</script>World'
			const expected = 'Hello World' // DOMPurify usually strips the content of script tags too
			expect(sanitizeText(input)).toBe(expected)
		})

		it('should handle attributes', () => {
			const input = '<a href="javascript:alert(1)">Link</a>'
			const expected = 'Link'
			expect(sanitizeText(input)).toBe(expected)
		})
	})

	describe('sanitizeHtml', () => {
		it('should allow safe tags', () => {
			const input = '<p>Hello <strong>World</strong></p>'
			expect(sanitizeHtml(input)).toBe(input)
		})

		it('should strip script tags', () => {
			const input = '<p>Hello <script>alert("xss")</script>World</p>'
			const expected = '<p>Hello World</p>'
			expect(sanitizeHtml(input)).toBe(expected)
		})

		it('should strip iframe tags', () => {
			const input = '<p>Hello <iframe src="evil.com"></iframe>World</p>'
			const expected = '<p>Hello World</p>'
			expect(sanitizeHtml(input)).toBe(expected)
		})

		it('should strip dangerous attributes', () => {
			const input = '<a href="javascript:alert(1)" onclick="alert(1)">Link</a>'
			// javascript: href should be stripped, onclick should be stripped.
			// DOMPurify removes the href content if it is javascript: but keeps the tag? Or removes the attribute?
			// With SafeHTML config, it allows 'a' and 'href'.
			// But ALLOWED_URI_REGEXP: /^(https?:|mailto:|tel:|\/)/i
			// javascript: does not match, so it should be stripped.
			// If href is empty/invalid, DOMPurify might strip the attribute.
			const expected = '<a>Link</a>'
			expect(sanitizeHtml(input)).toBe(expected)
		})

		it('should add target="_blank" to external links', () => {
			const input = '<a href="https://example.com">External</a>'
			const expected =
				'<a href="https://example.com" target="_blank" rel="noopener noreferrer">External</a>'
			expect(sanitizeHtml(input)).toBe(expected)
		})

		it('should NOT add target="_blank" to internal links', () => {
			const input = '<a href="/events/123">Internal</a>'
			const expected = '<a href="/events/123">Internal</a>'
			expect(sanitizeHtml(input)).toBe(expected)
		})
	})
})
