import { describe, it, expect } from 'vitest'
import { sanitizeText, sanitizeHtml } from '../../lib/sanitization.js'

describe('Sanitization Utils', () => {
	describe('sanitizeText', () => {
		it('should strip all HTML tags', () => {
			const input = '<p>Hello <b>World</b></p>'
			expect(sanitizeText(input)).toBe('Hello World')
		})

		it('should handle nested tags', () => {
			const input = '<div><p>Test</p></div>'
			expect(sanitizeText(input)).toBe('Test')
		})

		it('should handle scripts', () => {
			const input = '<script>alert("xss")</script>Test'
			expect(sanitizeText(input)).toBe('Test')
		})
	})

	describe('sanitizeHtml', () => {
		it('should allow safe tags', () => {
			const input = '<p>Hello <b>World</b></p>'
			expect(sanitizeHtml(input)).toBe('<p>Hello <b>World</b></p>')
		})

		it('should strip unsafe tags like script', () => {
			const input = '<p>Hello</p><script>alert("xss")</script>'
			expect(sanitizeHtml(input)).toBe('<p>Hello</p>')
		})

		it('should strip unsafe tags like iframe', () => {
			const input = '<p>Hello</p><iframe src="javascript:alert(1)"></iframe>'
			expect(sanitizeHtml(input)).toBe('<p>Hello</p>')
		})

		it('should strip on* event handlers', () => {
			const input = '<a href="#" onclick="alert(1)">Click me</a>'
			// Expect sanitized output to contain the link but NOT the onclick
			const output = sanitizeHtml(input)
			expect(output).toContain('<a')
			expect(output).not.toContain('onclick')
			expect(output).toContain('Click me')
		})

		it('should add target="_blank" and rel="noopener noreferrer" to links', () => {
			const input = '<a href="https://example.com">Example</a>'
			const output = sanitizeHtml(input)
			expect(output).toContain('target="_blank"')
			expect(output).toContain('rel="noopener noreferrer"')
			expect(output).toContain('href="https://example.com"')
		})

		it('should not add target="_blank" if already present', () => {
			const input = '<a href="https://example.com" target="_blank">Example</a>'
			const output = sanitizeHtml(input)
			// It might re-order attributes, but as long as it's there and valid
			expect(output).toContain('target="_blank"')
			expect(output).toContain('rel="noopener noreferrer"')
		})

		it('should allow basic formatting', () => {
			const input = '<ul><li>List 1</li><li>List 2</li></ul>'
			expect(sanitizeHtml(input)).toBe('<ul><li>List 1</li><li>List 2</li></ul>')
		})

		it('should allow images with src', () => {
			const input = '<img src="https://example.com/image.jpg" alt="test">'
			const output = sanitizeHtml(input)
			expect(output).toContain('<img')
			expect(output).toContain('src="https://example.com/image.jpg"')
			// alt might be preserved
		})
	})
})
