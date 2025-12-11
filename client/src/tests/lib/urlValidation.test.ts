import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isSafeNavigationUrl, safeNavigate } from '../../lib/urlValidation'

// Use jsdom environment for browser APIs
// @vitest-environment jsdom

describe('isSafeNavigationUrl', () => {
    describe('valid URLs', () => {
        it('allows http:// URLs', () => {
            expect(isSafeNavigationUrl('http://example.com')).toBe(true)
            expect(isSafeNavigationUrl('http://example.com/path')).toBe(true)
            expect(isSafeNavigationUrl('http://example.com:8080/path?query=1')).toBe(true)
        })

        it('allows https:// URLs', () => {
            expect(isSafeNavigationUrl('https://example.com')).toBe(true)
            expect(isSafeNavigationUrl('https://example.com/path')).toBe(true)
            expect(isSafeNavigationUrl('https://example.com/path#fragment')).toBe(true)
        })

        it('allows relative paths', () => {
            expect(isSafeNavigationUrl('/')).toBe(true)
            expect(isSafeNavigationUrl('/path')).toBe(true)
            expect(isSafeNavigationUrl('/path/to/page')).toBe(true)
            expect(isSafeNavigationUrl('/path?query=1')).toBe(true)
            expect(isSafeNavigationUrl('/path#fragment')).toBe(true)
        })

        it('handles whitespace in valid URLs', () => {
            expect(isSafeNavigationUrl('  https://example.com  ')).toBe(true)
            expect(isSafeNavigationUrl('  /path  ')).toBe(true)
        })
    })

    describe('invalid/malicious URLs', () => {
        it('blocks javascript: URLs', () => {
            expect(isSafeNavigationUrl('javascript:alert(1)')).toBe(false)
            expect(isSafeNavigationUrl('javascript:void(0)')).toBe(false)
            expect(isSafeNavigationUrl('JAVASCRIPT:alert(1)')).toBe(false)
        })

        it('blocks data: URLs', () => {
            expect(isSafeNavigationUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
            expect(isSafeNavigationUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(false)
        })

        it('blocks other non-HTTP schemes', () => {
            expect(isSafeNavigationUrl('file:///etc/passwd')).toBe(false)
            expect(isSafeNavigationUrl('ftp://example.com')).toBe(false)
            expect(isSafeNavigationUrl('mailto:test@example.com')).toBe(false)
            expect(isSafeNavigationUrl('tel:+1234567890')).toBe(false)
            expect(isSafeNavigationUrl('about:blank')).toBe(false)
        })

        it('blocks relative paths with protocol schemes', () => {
            expect(isSafeNavigationUrl('/javascript:alert(1)')).toBe(false)
            expect(isSafeNavigationUrl('/data:text/html,test')).toBe(false)
            expect(isSafeNavigationUrl('/file:///etc/passwd')).toBe(false)
            // But allow normal paths with colons in query/fragment
            expect(isSafeNavigationUrl('/path?time=12:00')).toBe(true)
            expect(isSafeNavigationUrl('/path#section:1')).toBe(true)
            // Allow colons in path segments (not protocol-like)
            expect(isSafeNavigationUrl('/path/to:something')).toBe(true)
            expect(isSafeNavigationUrl('/path/to/file:name')).toBe(true)
        })

        it('blocks invalid input', () => {
            expect(isSafeNavigationUrl('')).toBe(false)
            expect(isSafeNavigationUrl('   ')).toBe(false)
            expect(isSafeNavigationUrl(null as unknown as string)).toBe(false)
            expect(isSafeNavigationUrl(undefined as unknown as string)).toBe(false)
            expect(isSafeNavigationUrl(123 as unknown as string)).toBe(false)
            expect(isSafeNavigationUrl({} as unknown as string)).toBe(false)
        })

        it('blocks malformed URLs', () => {
            expect(isSafeNavigationUrl('not-a-url')).toBe(false)
            expect(isSafeNavigationUrl('://example.com')).toBe(false)
            expect(isSafeNavigationUrl('http://')).toBe(false)
        })
    })
})

describe('safeNavigate', () => {
    let mockNavigate: ReturnType<typeof vi.fn>
    let mockLocationHref: string

    beforeEach(() => {
        mockNavigate = vi.fn()
        mockLocationHref = ''
        
        // Mock window.location.href setter
        Object.defineProperty(window, 'location', {
            value: {
                get href() {
                    return mockLocationHref
                },
                set href(value: string) {
                    mockLocationHref = value
                },
            },
            writable: true,
            configurable: true,
        })
        
        // Mock console.warn to avoid test output noise
        vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
        // Reset the mock location href
        mockLocationHref = ''
    })

    describe('valid navigation', () => {
        it('navigates to external http:// URLs', () => {
            const result = safeNavigate('http://example.com', mockNavigate)
            
            expect(result).toBe(true)
            expect(mockLocationHref).toBe('http://example.com')
            expect(mockNavigate).not.toHaveBeenCalled()
        })

        it('navigates to external https:// URLs', () => {
            const result = safeNavigate('https://example.com/path', mockNavigate)
            
            expect(result).toBe(true)
            expect(mockLocationHref).toBe('https://example.com/path')
            expect(mockNavigate).not.toHaveBeenCalled()
        })

        it('navigates to relative paths using React Router', () => {
            const result = safeNavigate('/path/to/page', mockNavigate)
            
            expect(result).toBe(true)
            expect(mockNavigate).toHaveBeenCalledWith('/path/to/page')
            expect(mockNavigate).toHaveBeenCalledTimes(1)
        })

        it('handles root path', () => {
            const result = safeNavigate('/', mockNavigate)
            
            expect(result).toBe(true)
            expect(mockNavigate).toHaveBeenCalledWith('/')
        })
    })

    describe('blocked navigation', () => {
        it('blocks javascript: URLs', () => {
            const result = safeNavigate('javascript:alert(1)', mockNavigate)
            
            expect(result).toBe(false)
            expect(mockNavigate).not.toHaveBeenCalled()
            expect(mockLocationHref).toBe('')
            expect(console.warn).toHaveBeenCalledWith(
                '[URL Validation] Blocked unsafe URL:',
                'javascript:alert(1)'
            )
        })

        it('blocks data: URLs', () => {
            const result = safeNavigate('data:text/html,<script>alert(1)</script>', mockNavigate)
            
            expect(result).toBe(false)
            expect(mockNavigate).not.toHaveBeenCalled()
            expect(mockLocationHref).toBe('')
        })

        it('blocks other malicious schemes', () => {
            const maliciousUrls = [
                'file:///etc/passwd',
                'ftp://example.com',
                'mailto:test@example.com',
            ]
            
            maliciousUrls.forEach(url => {
                const result = safeNavigate(url, mockNavigate)
                expect(result).toBe(false)
            })
            
            expect(mockNavigate).not.toHaveBeenCalled()
            expect(mockLocationHref).toBe('')
        })

        it('blocks invalid input', () => {
            const result = safeNavigate('', mockNavigate)
            
            expect(result).toBe(false)
            expect(mockNavigate).not.toHaveBeenCalled()
        })
    })
})


