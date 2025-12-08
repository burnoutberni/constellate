/**
 * Utility functions for event form validation and payload building
 * Extracted from CreateEventModal for reusability and testability
 */

interface FormData {
    title: string
    summary: string
    location: string
    locationLatitude: string
    locationLongitude: string
    url: string
    startTime: string
    endTime: string
    visibility: string
    recurrencePattern: string
    recurrenceEndDate: string
    tags: string[]
}

/**
 * Validates recurrence pattern and end date
 */
export function validateRecurrence(formData: Pick<FormData, 'recurrencePattern' | 'recurrenceEndDate' | 'startTime'>): string | null {
    if (!formData.recurrencePattern) {
        return null
    }
    if (!formData.recurrenceEndDate) {
        return 'Please choose when the recurring event should stop.'
    }
    const startDate = new Date(formData.startTime)
    // Parse recurrence end date as end of day in UTC to avoid timezone issues
    const recurrenceEnd = new Date(formData.recurrenceEndDate + 'T23:59:59.999Z')
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(recurrenceEnd.getTime())) {
        return 'Please provide valid dates for recurring events.'
    }
    // Compare only the date parts (without time) to match backend validation
    const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
    const recurrenceEndDateOnly = new Date(recurrenceEnd.getFullYear(), recurrenceEnd.getMonth(), recurrenceEnd.getDate())
    // Backend requires recurrence end date to be strictly after start time
    if (recurrenceEndDateOnly <= startDateOnly) {
        return 'Recurrence end date must be after the start date.'
    }
    return null
}

/**
 * Parses and validates coordinate inputs
 */
export function parseCoordinates(formData: Pick<FormData, 'locationLatitude' | 'locationLongitude'>): { latitude?: number; longitude?: number; error?: string } {
    const hasLatitude = formData.locationLatitude.trim() !== ''
    const hasLongitude = formData.locationLongitude.trim() !== ''
    if (hasLatitude !== hasLongitude) {
        return { error: 'Latitude and longitude must both be provided or both omitted.' }
    }
    if (!hasLatitude && !hasLongitude) {
        return {}
    }
    const latitude = Number(formData.locationLatitude)
    const longitude = Number(formData.locationLongitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return { error: 'Latitude and longitude must be valid decimal numbers.' }
    }
    return { latitude, longitude }
}

/**
 * Builds the event payload for API submission
 */
export function buildEventPayload(
    formData: Pick<FormData, 'title' | 'summary' | 'location' | 'url' | 'startTime' | 'endTime' | 'visibility' | 'recurrencePattern' | 'recurrenceEndDate'>,
    locationLatitude?: number,
    locationLongitude?: number
): Record<string, unknown> {
    const payload: Record<string, unknown> = {
        title: formData.title,
        summary: formData.summary,
        location: formData.location,
        url: formData.url,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: formData.endTime ? new Date(formData.endTime).toISOString() : undefined,
        visibility: formData.visibility,
    }
    if (locationLatitude !== undefined && locationLongitude !== undefined) {
        payload.locationLatitude = locationLatitude
        payload.locationLongitude = locationLongitude
    }
    if (formData.recurrencePattern) {
        payload.recurrencePattern = formData.recurrencePattern
        // Use the same end-of-day parsing logic as validation to ensure consistency (UTC)
        payload.recurrenceEndDate = new Date(formData.recurrenceEndDate + 'T23:59:59.999Z').toISOString()
    }
    return payload
}
