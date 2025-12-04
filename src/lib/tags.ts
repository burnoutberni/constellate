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
 */
export function normalizeTags(tags: string[]): string[] {
    const normalized = tags.map(tag => 
        tag.toLowerCase().trim().replace(/^#/, '')
    ).filter(tag => tag.length > 0)
    
    return [...new Set(normalized)]
}
