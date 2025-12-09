/**
 * Utility function to merge Tailwind CSS classes
 * Simple implementation that handles arrays, objects, and strings
 */
export function cn(...inputs: (string | undefined | null | boolean | Record<string, boolean> | string[] | number)[]): string {
  const classes: string[] = []
  
  for (const input of inputs) {
    if (input === null || input === undefined || input === false) continue
    
    if (typeof input === 'string') {
      classes.push(input)
    } else if (typeof input === 'number') {
      // Numbers are valid but we skip them (they're often used in conditionals)
      continue
    } else if (Array.isArray(input)) {
      const inner = cn(...input)
      if (inner) classes.push(inner)
    } else if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        if (value) classes.push(key)
      }
    }
  }
  
  // Basic deduplication - keep last occurrence of each class
  const seen = new Set<string>()
  const result: string[] = []
  
  for (const cls of classes.reverse()) {
    const parts = cls.split(' ')
    for (const part of parts) {
      if (part && !seen.has(part)) {
        seen.add(part)
        result.unshift(part)
      }
    }
  }
  
  return result.join(' ')
}
