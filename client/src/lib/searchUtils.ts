/**
 * Search and Discovery Utilities
 * Shared utilities for event search, discovery, and filtering
 */

<<<<<<< HEAD
import { BACKEND_DATE_RANGES, type BackendDateRange } from './searchConstants'
=======
import { BACKEND_DATE_RANGES, type BackendDateRange } from '../components/EventFilters'
>>>>>>> f4db472 (Address code review feedback: Extract shared utilities and improve accessibility)

/**
 * Parse a comma-separated string into an array of trimmed non-empty items
 */
export const parseCommaList = (value?: string | null): string[] =>
    value
        ? value
              .split(',')
              .map((item) => item.trim())
              .filter((item) => item.length > 0)
        : []

/**
 * Convert ISO date string to input date format (YYYY-MM-DD)
 */
export const isoToInputDate = (value?: string | null): string => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return ''
    }
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

/**
 * Convert input date string (YYYY-MM-DD) to ISO format
 * @param value - Input date string
 * @param endOfDay - If true, sets time to 23:59:59.999, otherwise 00:00:00.000
 */
export const inputDateToISO = (value: string, endOfDay = false): string | undefined => {
    if (!value) return undefined
    const [yearStr, monthStr, dayStr] = value.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr)
    const day = Number(dayStr)

    if (!year || !month || !day) {
        return undefined
    }

    const hours = endOfDay ? 23 : 0
    const minutes = endOfDay ? 59 : 0
    const seconds = endOfDay ? 59 : 0
    const millis = endOfDay ? 999 : 0

    const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, millis))
    return date.toISOString()
}

/**
 * Type guard to check if a string is a valid backend date range preset
 */
export function isBackendDateRange(value: string): value is BackendDateRange {
    return BACKEND_DATE_RANGES.includes(value as BackendDateRange)
}

/**
 * Format ISO date string to a localized date label
 */
export const formatDateLabel = (isoString: string): string => {
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) {
        return isoString
    }
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
}

/**
 * Normalize a category/tag string by removing leading # symbols and converting to lowercase
 */
export const normalizeCategory = (value: string): string => 
    value.trim().replace(/^#+/, '').toLowerCase()
