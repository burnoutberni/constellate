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
 * Helper function to set or remove a conditional meta tag
 */
function setOrRemoveMetaTag(
  attributeName: 'name' | 'property',
  attributeValue: string,
  content: string | undefined,
): void {
  if (content) {
    setOrUpdateMetaTag(attributeName, attributeValue, content)
  } else {
    removeMetaTag(attributeName, attributeValue)
  }
}

/**
 * Helper function to set document title
 */
function setDocumentTitle(title: string | undefined): void {
  document.title = title ? `${title} - Constellate` : 'Constellate'
}

/**
 * Helper function to set Open Graph tags
 */
function setOpenGraphTags(
  title: string | undefined,
  description: string | undefined,
  ogImage: string | undefined,
  ogType: 'website' | 'article' | 'event',
): void {
  setOrRemoveMetaTag('property', 'og:title', title)
  setOrRemoveMetaTag('property', 'og:description', description)
  setOrRemoveMetaTag('property', 'og:image', ogImage)
  setOrUpdateMetaTag('property', 'og:type', ogType)
}

/**
 * Helper function to set Twitter Card tags
 */
function setTwitterCardTags(
  title: string | undefined,
  description: string | undefined,
  ogImage: string | undefined,
): void {
  setOrRemoveMetaTag('name', 'twitter:title', title)
  setOrRemoveMetaTag('name', 'twitter:description', description)
  if (ogImage) {
    setOrUpdateMetaTag('name', 'twitter:image', ogImage)
    setOrUpdateMetaTag('name', 'twitter:card', 'summary_large_image')
  } else {
    removeMetaTag('name', 'twitter:image')
    setOrUpdateMetaTag('name', 'twitter:card', 'summary')
  }
}

/**
 * Sets SEO metadata for the current page.
 * Updates document title and meta tags.
 * Removes meta tags when values are no longer provided.
 */
export function setSEOMetadata({
  title,
  description,
  canonicalUrl,
  ogImage,
  ogType = 'website',
}: SEOMetadata): void {
  setDocumentTitle(title)
  setOrRemoveMetaTag('name', 'description', description)
  setOpenGraphTags(title, description, ogImage, ogType)

  if (canonicalUrl) {
    setOrUpdateLink('canonical', canonicalUrl)
  } else {
    removeLink('canonical')
  }

  setTwitterCardTags(title, description, ogImage)
}

/**
 * Helper function to set or update a meta tag
 */
function setOrUpdateMetaTag(
  attributeName: 'name' | 'property',
  attributeValue: string,
  content: string,
): void {
  let element = document.querySelector(
    `meta[${attributeName}="${attributeValue}"]`,
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
 * Helper function to remove a meta tag
 */
function removeMetaTag(
  attributeName: 'name' | 'property',
  attributeValue: string,
): void {
  const element = document.querySelector(
    `meta[${attributeName}="${attributeValue}"]`,
  ) as HTMLMetaElement | null

  if (element) {
    element.remove()
  }
}

/**
 * Helper function to set or update a link tag
 */
function setOrUpdateLink(rel: string, href: string): void {
  let element = document.querySelector(
    `link[rel="${rel}"]`,
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
 * Helper function to remove a link tag
 */
function removeLink(rel: string): void {
  const element = document.querySelector(
    `link[rel="${rel}"]`,
  ) as HTMLLinkElement | null

  if (element) {
    element.remove()
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
    'Constellate - Federated event management platform',
  )
}
