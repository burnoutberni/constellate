/**
 * Search Constants
 * Shared constants for event search and filtering
 */

export const DATE_RANGE_LABELS: Record<string, string> = {
    anytime: 'Any time',
    custom: 'Custom range',
    today: 'Today',
    tomorrow: 'Tomorrow',
    this_weekend: 'This weekend',
    next_7_days: 'Next 7 days',
    next_30_days: 'Next 30 days',
}

export const BACKEND_DATE_RANGES = ['today', 'tomorrow', 'this_weekend', 'next_7_days', 'next_30_days'] as const
export type BackendDateRange = (typeof BACKEND_DATE_RANGES)[number]
export type DateRangeSelection = 'anytime' | 'custom' | BackendDateRange
