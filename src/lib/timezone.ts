const intl = Intl as typeof Intl & {
    supportedValuesOf?: (type: 'timeZone') => string[]
}

export const DEFAULT_TIMEZONE = 'UTC'

export function isValidTimeZone(value: string | null | undefined): value is string {
    if (!value) {
        return false
    }

    if (typeof intl.supportedValuesOf === 'function') {
        return intl.supportedValuesOf('timeZone').includes(value)
    }

    try {
        // Intl throws when the timezone identifier is invalid
        new Intl.DateTimeFormat('en-US', { timeZone: value })
        return true
    } catch {
        return false
    }
}

export function normalizeTimeZone(value: string | null | undefined, fallback = DEFAULT_TIMEZONE) {
    return isValidTimeZone(value) ? value : fallback
}
