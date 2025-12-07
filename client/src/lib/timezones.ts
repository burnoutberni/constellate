const intl = Intl as typeof Intl & {
    supportedValuesOf?: (type: 'timeZone') => string[]
}

const FALLBACK_TIMEZONES = [
    'UTC',
    'America/Los_Angeles',
    'America/New_York',
    'Europe/London',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Singapore',
    'Australia/Sydney',
]

export function getDefaultTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    } catch {
        return 'UTC'
    }
}

export function getSupportedTimezones() {
    if (typeof intl.supportedValuesOf === 'function') {
        return intl.supportedValuesOf('timeZone')
    }

    const defaultTz = getDefaultTimezone()
    const set = new Set([defaultTz, ...FALLBACK_TIMEZONES])
    return Array.from(set).sort()
}
