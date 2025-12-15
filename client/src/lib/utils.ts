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
