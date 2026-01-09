import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility function to merge Tailwind CSS classes
 * Uses clsx for conditional class handling and tailwind-merge to resolve conflicts
 * Example: cn('p-2', 'p-4') resolves to just 'p-4'
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

/**
 * Generates a unique ID using crypto.randomUUID() with a fallback for environments
 * that don't support it (e.g., older browsers, jsdom in tests)
 * @returns A unique string identifier
 */
export function generateId(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID()
	}
	// Fallback for environments without crypto.randomUUID support
	return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Generate initials from a name or username
 * @param name - Full name (e.g., "Alice Wonder")
 * @param username - Username fallback (e.g., "alice_wonder")
 * @returns Initials (e.g., "AW" from name, or "AW" from username)
 */
export function getInitials(name?: string | null, username?: string | null): string {
	// Try to get initials from name first
	if (name) {
		const trimmedName = name.trim()
		if (trimmedName) {
			const parts = trimmedName.split(/\s+/)
			if (parts.length >= 2) {
				// Use first letter of first and last name
				return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
			}
			// Single name - use first two letters
			return trimmedName.slice(0, 2).toUpperCase()
		}
	}

	// Fallback to username
	if (username) {
		// Remove @ if present at the start
		let cleanUsername = username.startsWith('@') ? username.slice(1) : username

		// For federated usernames (user@domain.com), extract just the local part
		const atIndex = cleanUsername.indexOf('@')
		if (atIndex > 0) {
			cleanUsername = cleanUsername.slice(0, atIndex)
		}

		// Try to split on common separators (_, -, .)
		const parts = cleanUsername.split(/[_\-.]/).filter(Boolean)
		if (parts.length >= 2) {
			// Use first letter of first two parts
			const first = parts[0]?.[0]
			const second = parts[1]?.[0]
			if (first && second) {
				return (first + second).toUpperCase()
			}
		}

		// Single part - use first two letters
		return cleanUsername.slice(0, 2).toUpperCase()
	}

	return '?'
}
