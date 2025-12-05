/**
 * Tag normalization utilities
 * Handles: lowercase, trim, #-prefix removal, empty string filtering, and deduplication
 */

/**
 * Normalizes an array of tags by:
 * - Converting to lowercase
 * - Trimming whitespace
 * - Removing leading # character
 * - Filtering out empty strings
 * - Removing duplicates
 * 
 * @param tags - Array of raw tag strings to normalize
 * @returns Array of normalized, unique, non-empty tags
 */
export function normalizeTags(tags: string[]): string[] {
    if (!Array.isArray(tags) || tags.length === 0) {
        return []
    }
    
    const normalized = tags
        .filter((tag): tag is string => typeof tag === 'string' && tag != null)
        .map(tag => 
            String(tag).replace(/^#/, '').trim().toLowerCase()
        )
        .filter(tag => tag.length > 0)
    
    return [...new Set(normalized)]
}
