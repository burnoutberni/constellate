/**
 * Tag normalization utilities
 * Handles: lowercase, trim, #-prefix removal, empty string filtering, and deduplication
 */

/**
 * Normalizes an array of tags by:
<<<<<<< HEAD
 * - Trimming leading/trailing whitespace
 * - Removing leading # characters
 * - Trimming again (to remove whitespace that may have been between # and content)
 * - Converting to lowercase
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
        .filter((tag): tag is string => typeof tag === 'string')
        .map(tag => 
            tag.trim().replace(/^#+/, '').trim().toLowerCase()
        )
        .filter(tag => tag.length > 0)
=======
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
    const normalized = tags.map(tag => 
        tag.replace(/^#/, '').trim().toLowerCase()
    ).filter(tag => tag.length > 0)
>>>>>>> 334d1e9 (Resolve PR comments: add normalizeTags utility, fix tag validation and React key)
    
    return [...new Set(normalized)]
}
