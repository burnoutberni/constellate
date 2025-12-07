const intl = Intl as typeof Intl & {
    supportedValuesOf?: (type: 'timeZone') => string[]
}

const FALLBACK_TIMEZONES = [
    'UTC',
    'America/Los_Angeles',
    'America/New_York',
    'America/Chicago',
    'Europe/London',
    'Europe/Berlin',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Dubai',
    'Asia/Singapore',
    'Australia/Sydney',
    'Africa/Cairo',
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
