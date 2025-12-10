/**
 * Centralized date and time formatting utilities
 * Provides consistent date/time formatting across the application
 */

/**
 * Formats a date string to a localized date string
 * @param dateString - ISO date string
 * @param options - Optional Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatDate(
    dateString: string,
    options?: Intl.DateTimeFormatOptions
): string {
    const defaultOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }
    return new Date(dateString).toLocaleDateString(
        navigator.language || 'en-US',
        options || defaultOptions
    )
}

/**
 * Formats a date string to a localized time string
 * @param dateString - ISO date string
 * @param options - Optional Intl.DateTimeFormatOptions
 * @returns Formatted time string
 */
export function formatTime(
    dateString: string,
    options?: Intl.DateTimeFormatOptions
): string {
    const defaultOptions: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: '2-digit',
    }
    return new Date(dateString).toLocaleTimeString(
        navigator.language || 'en-US',
        options || defaultOptions
    )
}

/**
 * Formats a date string to a relative date string (Today, Tomorrow, etc.)
 * Falls back to a formatted date string for dates further in the future
 * @param dateString - ISO date string
 * @returns Relative date string or formatted date
 */
export function formatRelativeDate(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()

    // Compare dates at start of day (midnight) to get calendar day difference
    const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const days = Math.floor((dateStart.getTime() - nowStart.getTime()) / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Today'
    if (days === 1) return 'Tomorrow'
    if (days > 1 && days < 7) return `In ${days} days`

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
}
