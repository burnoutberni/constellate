import { describe, it, expect } from 'vitest'
import { sanitizeText, sanitizeHtml } from '../lib/sanitization'

describe('Sanitization', () => {
	describe('sanitizeText', () => {
		it('removes all HTML tags', () => {
			const input = '<p>Hello <b>World</b></p>'
			const expected = 'Hello World'
			expect(sanitizeText(input)).toBe(expected)
		})

		it('handles malicious scripts', () => {
			const input = '<script>alert("xss")</script>Hello'
			const expected = 'Hello'
			expect(sanitizeText(input)).toBe(expected)
		})

		it('handles empty input', () => {
			expect(sanitizeText('')).toBe('')
		})
	})

	describe('sanitizeHtml', () => {
		it('allows safe tags', () => {
			const input = '<p>Hello <b>World</b></p>'
			const expected = '<p>Hello <b>World</b></p>'
			expect(sanitizeHtml(input)).toBe(expected)
		})

		it('removes unsafe tags like script', () => {
			const input = '<div><script>alert("xss")</script>Hello</div>'
			const expected = '<div>Hello</div>'
			expect(sanitizeHtml(input)).toBe(expected)
		})

		it('removes unsafe attributes', () => {
			const input = '<a href="javascript:alert(1)" onclick="alert(1)">Click me</a>'
			const result = sanitizeHtml(input)
			expect(result).not.toContain('javascript:')
			expect(result).not.toContain('onclick')
			expect(result).toContain('Click me')
		})

		it('allows safe attributes', () => {
			const input = '<a href="https://example.com" title="Example">Link</a>'
			const expected = '<a href="https://example.com" title="Example">Link</a>'
			expect(sanitizeHtml(input)).toBe(expected)
		})

		it('removes iframe', () => {
			const input = '<iframe src="http://evil.com"></iframe>'
			const expected = ''
			expect(sanitizeHtml(input)).toBe(expected)
		})
	})
})
