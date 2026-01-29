import { describe, it, expect } from 'vitest'
import { sanitizeHtml, sanitizeText } from '../lib/sanitization.js'

describe('Sanitization', () => {
    describe('sanitizeText', () => {
        it('should strip HTML tags', () => {
            const input = '<p>Hello <strong>world</strong></p>'
            expect(sanitizeText(input)).toBe('Hello world')
        })

        it('should handle plain text', () => {
            const input = 'Hello world'
            expect(sanitizeText(input)).toBe('Hello world')
        })

        it('should remove scripts', () => {
            const input = '<script>alert(1)</script>Hello'
            expect(sanitizeText(input)).toBe('Hello')
        })
    })

    describe('sanitizeHtml', () => {
        it('should allow safe tags', () => {
            const input = '<p>Hello <strong>world</strong></p>'
            expect(sanitizeHtml(input)).toBe('<p>Hello <strong>world</strong></p>')
        })

        it('should strip unsafe tags', () => {
            const input = '<script>alert(1)</script><p>Hello</p>'
            expect(sanitizeHtml(input)).toBe('<p>Hello</p>')
        })

        it('should strip unsafe attributes', () => {
            const input = '<p onclick="alert(1)">Hello</p>'
            expect(sanitizeHtml(input)).toBe('<p>Hello</p>')
        })

        it('should allow links', () => {
            const input = '<a href="https://example.com">Link</a>'
            expect(sanitizeHtml(input)).toBe('<a href="https://example.com">Link</a>')
        })

        it('should strip javascript: links', () => {
            const input = '<a href="javascript:alert(1)">Link</a>'
            const output = sanitizeHtml(input)
            // It might remove the attribute or the whole tag depending on config, but definitely no javascript:
            expect(output).not.toContain('javascript:')
        })

        it('should allow headers', () => {
             const input = '<h1>Title</h1>'
             expect(sanitizeHtml(input)).toBe('<h1>Title</h1>')
        })
    })
})
