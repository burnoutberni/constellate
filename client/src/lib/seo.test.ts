import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setSEOMetadata, resetSEOMetadata } from './seo'

describe('seo', () => {
  // Store original document state
  let originalTitle: string
  let originalMetaTags: HTMLMetaElement[]

  beforeEach(() => {
    originalTitle = document.title
    originalMetaTags = Array.from(document.head.querySelectorAll('meta'))
  })

  afterEach(() => {
    // Clean up - restore original title
    document.title = originalTitle

    // Remove all meta tags added during tests
    document.head.querySelectorAll('meta').forEach((meta) => {
      if (!originalMetaTags.includes(meta)) {
        meta.remove()
      }
    })

    // Remove any link tags added
    document.head.querySelectorAll('link[rel="canonical"]').forEach((link) => {
      link.remove()
    })
  })

  describe('setSEOMetadata', () => {
    it('sets document title with app name appended', () => {
      setSEOMetadata({ title: 'Test Event' })

      expect(document.title).toBe('Test Event - Constellate')
    })

    it('sets default title when no title provided', () => {
      setSEOMetadata({})

      expect(document.title).toBe('Constellate')
    })

    it('sets meta description', () => {
      setSEOMetadata({ description: 'Test description' })

      const metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement
      expect(metaDescription?.content).toBe('Test description')
    })

    it('sets Open Graph meta tags', () => {
      setSEOMetadata({
        title: 'Test Event',
        description: 'Test description',
        ogType: 'event',
      })

      const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement
      const ogDescription = document.querySelector('meta[property="og:description"]') as HTMLMetaElement
      const ogType = document.querySelector('meta[property="og:type"]') as HTMLMetaElement

      expect(ogTitle?.content).toBe('Test Event')
      expect(ogDescription?.content).toBe('Test description')
      expect(ogType?.content).toBe('event')
    })

    it('sets Open Graph image', () => {
      setSEOMetadata({ ogImage: 'https://example.com/image.jpg' })

      const ogImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement
      expect(ogImage?.content).toBe('https://example.com/image.jpg')
    })

    it('sets Twitter Card meta tags', () => {
      setSEOMetadata({
        title: 'Test Event',
        description: 'Test description',
        ogImage: 'https://example.com/image.jpg',
      })

      const twitterTitle = document.querySelector('meta[name="twitter:title"]') as HTMLMetaElement
      const twitterDescription = document.querySelector('meta[name="twitter:description"]') as HTMLMetaElement
      const twitterImage = document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement
      const twitterCard = document.querySelector('meta[name="twitter:card"]') as HTMLMetaElement

      expect(twitterTitle?.content).toBe('Test Event')
      expect(twitterDescription?.content).toBe('Test description')
      expect(twitterImage?.content).toBe('https://example.com/image.jpg')
      expect(twitterCard?.content).toBe('summary_large_image')
    })

    it('sets canonical URL', () => {
      setSEOMetadata({ canonicalUrl: 'https://example.com/event/123' })

      const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement
      expect(canonical?.href).toBe('https://example.com/event/123')
    })

    it('updates existing meta tags instead of duplicating', () => {
      setSEOMetadata({ title: 'First Title' })
      setSEOMetadata({ title: 'Second Title' })

      const ogTitleTags = document.querySelectorAll('meta[property="og:title"]')
      expect(ogTitleTags.length).toBe(1)
      expect((ogTitleTags[0] as HTMLMetaElement).content).toBe('Second Title')
    })
  })

  describe('resetSEOMetadata', () => {
    it('resets document title to default', () => {
      document.title = 'Custom Title'
      resetSEOMetadata()

      expect(document.title).toBe('Constellate')
    })

    it('resets meta description to default', () => {
      setSEOMetadata({ description: 'Custom description' })
      resetSEOMetadata()

      const metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement
      expect(metaDescription?.content).toBe('Constellate - Federated event management platform')
    })
  })
})
