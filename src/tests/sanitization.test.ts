import { describe, it, expect } from 'vitest'
import { sanitizeHtml, sanitizeText } from '../lib/sanitization.js'

describe('Sanitization', () => {
	describe('sanitizeText', () => {
		it('removes all HTML tags', () => {
			const input = '<p>Hello <b>World</b></p>'
			expect(sanitizeText(input)).toBe('Hello World')
		})

		it('removes scripts', () => {
			const input = '<script>alert(1)</script>Hello'
			expect(sanitizeText(input)).toBe('Hello')
		})

		it('handles plain text', () => {
			const input = 'Hello World'
			expect(sanitizeText(input)).toBe('Hello World')
		})
	})

	describe('sanitizeHtml', () => {
		it('preserves safe tags', () => {
			const input = '<p>Hello <b>World</b></p>'
			expect(sanitizeHtml(input)).toBe('<p>Hello <b>World</b></p>')
		})

		it('removes scripts', () => {
			const input = '<script>alert(1)</script><p>Hello</p>'
			expect(sanitizeHtml(input)).toBe('<p>Hello</p>')
		})

		it('removes dangerous attributes', () => {
			const input = '<p onclick="alert(1)">Hello</p>'
			expect(sanitizeHtml(input)).toBe('<p>Hello</p>')
		})

		it('removes iframes', () => {
			const input = '<iframe src="javascript:alert(1)"></iframe><p>Hello</p>'
			expect(sanitizeHtml(input)).toBe('<p>Hello</p>')
		})

		it('adds rel/target to external links', () => {
			const input = '<a href="https://example.com">Link</a>'
			const output = sanitizeHtml(input)
			expect(output).toContain('target="_blank"')
			expect(output).toContain('rel="noopener noreferrer"')
		})

		it('does not add rel/target to internal links', () => {
			const input = '<a href="/internal">Link</a>'
			const output = sanitizeHtml(input)
			expect(output).not.toContain('target="_blank"')
		})
	})
})
