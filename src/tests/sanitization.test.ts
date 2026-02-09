import { describe, it, expect } from 'vitest'
import { sanitizeHtml, sanitizeText } from '../lib/sanitization.js'

describe('Sanitization', () => {
    describe('sanitizeHtml', () => {
        it('should strip script tags', () => {
            const input = '<script>alert(1)</script>Hello'
            expect(sanitizeHtml(input)).toBe('Hello')
        })

        it('should strip iframe tags', () => {
            const input = '<iframe src="javascript:alert(1)"></iframe>Hello'
            expect(sanitizeHtml(input)).toBe('Hello')
        })

        it('should strip object tags', () => {
            const input = '<object data="javascript:alert(1)"></object>Hello'
            expect(sanitizeHtml(input)).toBe('Hello')
        })

        it('should allow safe tags', () => {
            const input = '<b>Bold</b> <i>Italic</i> <a href="https://example.com">Link</a>'
            expect(sanitizeHtml(input)).toBe('<b>Bold</b> <i>Italic</i> <a href="https://example.com">Link</a>')
        })

        it('should strip unsafe attributes', () => {
            const input = '<a href="https://example.com" onclick="alert(1)">Link</a>'
            expect(sanitizeHtml(input)).toBe('<a href="https://example.com">Link</a>')
        })

        it('should strip javascript: href', () => {
            const input = '<a href="javascript:alert(1)">Link</a>'
            // DOMPurify typically removes the whole href attribute or the tag depending on config,
            // but here it should strip the href content or the attribute.
            // Let's expect it to not contain javascript:
            const output = sanitizeHtml(input)
            expect(output).not.toContain('javascript:')
        })

        it('should allow headings', () => {
            const input = '<h1>Title</h1>'
            expect(sanitizeHtml(input)).toBe('<h1>Title</h1>')
        })
    })

    describe('sanitizeText', () => {
        it('should strip all tags', () => {
            const input = '<b>Bold</b>'
            expect(sanitizeText(input)).toBe('Bold')
        })
    })
})
