/**
 * SEO utilities for managing document head metadata
 */

export interface SEOMetadata {
  /**
   * Page title (will be appended with " - Constellate")
   */
  title?: string
  /**
   * Page description for meta tag
   */
  description?: string
  /**
   * Canonical URL for the page
   */
  canonicalUrl?: string
  /**
   * Open Graph image URL
   */
  ogImage?: string
  /**
   * Open Graph type
   */
  ogType?: 'website' | 'article' | 'event'
}

/**
 * Sets SEO metadata for the current page.
 * Updates document title and meta tags.
 */
export function setSEOMetadata({
  title,
  description,
  canonicalUrl,
  ogImage,
  ogType = 'website',
}: SEOMetadata): void {
  // Set document title
  if (title) {
    document.title = `${title} - Constellate`
  } else {
    document.title = 'Constellate'
  }

  // Set or update meta description
  if (description) {
    setOrUpdateMetaTag('name', 'description', description)
  }

  // Set Open Graph meta tags
  if (title) {
    setOrUpdateMetaTag('property', 'og:title', title)
  }
  if (description) {
    setOrUpdateMetaTag('property', 'og:description', description)
  }
  if (ogImage) {
    setOrUpdateMetaTag('property', 'og:image', ogImage)
  }
  setOrUpdateMetaTag('property', 'og:type', ogType)

  // Set canonical URL
  if (canonicalUrl) {
    setOrUpdateLink('canonical', canonicalUrl)
  }

  // Set Twitter Card meta tags
  if (title) {
    setOrUpdateMetaTag('name', 'twitter:title', title)
  }
  if (description) {
    setOrUpdateMetaTag('name', 'twitter:description', description)
  }
  if (ogImage) {
    setOrUpdateMetaTag('name', 'twitter:image', ogImage)
    setOrUpdateMetaTag('name', 'twitter:card', 'summary_large_image')
  } else {
    setOrUpdateMetaTag('name', 'twitter:card', 'summary')
  }
}

/**
 * Helper function to set or update a meta tag
 */
function setOrUpdateMetaTag(
  attributeName: 'name' | 'property',
  attributeValue: string,
  content: string
): void {
  let element = document.querySelector(
    `meta[${attributeName}="${attributeValue}"]`
  ) as HTMLMetaElement | null

  if (element) {
    element.content = content
  } else {
    element = document.createElement('meta')
    element.setAttribute(attributeName, attributeValue)
    element.content = content
    document.head.appendChild(element)
  }
}

/**
 * Helper function to set or update a link tag
 */
function setOrUpdateLink(rel: string, href: string): void {
  let element = document.querySelector(
    `link[rel="${rel}"]`
  ) as HTMLLinkElement | null

  if (element) {
    element.href = href
  } else {
    element = document.createElement('link')
    element.rel = rel
    element.href = href
    document.head.appendChild(element)
  }
}

/**
 * Resets SEO metadata to defaults
 */
export function resetSEOMetadata(): void {
  document.title = 'Constellate'
  setOrUpdateMetaTag(
    'name',
    'description',
    'Constellate - Federated event management platform'
  )
}
