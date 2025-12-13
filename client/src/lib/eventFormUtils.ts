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
export function validateRecurrence(
	formData: Pick<FormData, 'recurrencePattern' | 'recurrenceEndDate' | 'startTime'>
): string | null {
	if (!formData.recurrencePattern) {
		return null
	}
	if (!formData.recurrenceEndDate) {
		return 'Please choose when the recurring event should stop.'
	}
	const startDate = new Date(formData.startTime)
	// Parse recurrence end date as end of day in UTC to avoid timezone issues
	const recurrenceEnd = new Date(`${formData.recurrenceEndDate}T23:59:59.999Z`)
	if (Number.isNaN(startDate.getTime()) || Number.isNaN(recurrenceEnd.getTime())) {
		return 'Please provide valid dates for recurring events.'
	}
	// Compare only the date parts (without time) to match backend validation
	const startDateOnly = new Date(
		startDate.getFullYear(),
		startDate.getMonth(),
		startDate.getDate()
	)
	const recurrenceEndDateOnly = new Date(
		recurrenceEnd.getFullYear(),
		recurrenceEnd.getMonth(),
		recurrenceEnd.getDate()
	)
	// Backend requires recurrence end date to be strictly after start time
	if (recurrenceEndDateOnly <= startDateOnly) {
		return 'Recurrence end date must be after the start date.'
	}
	return null
}

/**
 * Parses and validates coordinate inputs
 * @returns A discriminated union: either an error object, a success object with coordinates, or an empty object if no coordinates provided
 */
export function parseCoordinates(
	formData: Pick<FormData, 'locationLatitude' | 'locationLongitude'>
): { error: string } | { latitude: number; longitude: number } | Record<string, never> {
	const hasLatitude = formData.locationLatitude.trim() !== ''
	const hasLongitude = formData.locationLongitude.trim() !== ''
	if (hasLatitude !== hasLongitude) {
		const missingField = hasLatitude ? 'longitude' : 'latitude'
		return {
			error: `Both latitude and longitude must be provided together, but ${missingField} is not provided.`,
		}
	}
	if (!hasLatitude && !hasLongitude) {
		return {}
	}
	const latitude = Number(formData.locationLatitude)
	const longitude = Number(formData.locationLongitude)
	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
		return { error: 'Latitude and longitude must be valid decimal numbers.' }
	}
	if (latitude < -90 || latitude > 90) {
		return { error: 'Latitude must be between -90 and 90 degrees.' }
	}
	if (longitude < -180 || longitude > 180) {
		return { error: 'Longitude must be between -180 and 180 degrees.' }
	}
	return { latitude, longitude }
}

/**
 * Helper function to add optional fields for update operations
 */
function addOptionalFieldsForUpdate(
	formData: Pick<FormData, 'summary' | 'location' | 'url'>
): Record<string, unknown> {
	const fields: Record<string, unknown> = {}
	// All fields are always defined in FormData, so we always add them
	fields.summary = formData.summary.trim() || null
	fields.location = formData.location.trim() || null
	fields.url = formData.url.trim() || null
	return fields
}

/**
 * Helper function to add optional fields for create operations
 */
function addOptionalFieldsForCreate(
	formData: Pick<FormData, 'summary' | 'location' | 'url'>
): Record<string, unknown> {
	const fields: Record<string, unknown> = {}
	if (formData.summary && formData.summary.trim()) {
		fields.summary = formData.summary
	}
	if (formData.location && formData.location.trim()) {
		fields.location = formData.location
	}
	if (formData.url && formData.url.trim()) {
		fields.url = formData.url
	}
	return fields
}

/**
 * Builds the event payload for API submission
 * @param isUpdate - If true, allows explicit empty strings/null to clear optional fields during updates.
 *                    If false (default), only includes fields with non-empty values (for creates).
 */
export function buildEventPayload(
	formData: Pick<
		FormData,
		| 'title'
		| 'summary'
		| 'location'
		| 'url'
		| 'startTime'
		| 'endTime'
		| 'visibility'
		| 'recurrencePattern'
		| 'recurrenceEndDate'
	>,
	locationLatitude?: number,
	locationLongitude?: number,
	isUpdate: boolean = false
): Record<string, unknown> {
	const payload: Record<string, unknown> = {
		title: formData.title,
		startTime: new Date(formData.startTime).toISOString(),
		endTime: formData.endTime ? new Date(formData.endTime).toISOString() : undefined,
		visibility: formData.visibility,
	}

	// For updates, include fields even if empty (to allow clearing them)
	// For creates, only include fields with non-empty values
	if (isUpdate) {
		Object.assign(payload, addOptionalFieldsForUpdate(formData))
	} else {
		Object.assign(payload, addOptionalFieldsForCreate(formData))
	}

	if (locationLatitude !== undefined && locationLongitude !== undefined) {
		payload.locationLatitude = locationLatitude
		payload.locationLongitude = locationLongitude
	}
	if (formData.recurrencePattern) {
		payload.recurrencePattern = formData.recurrencePattern
		// Use the same end-of-day parsing logic as validation to ensure consistency (UTC)
		payload.recurrenceEndDate = new Date(
			`${formData.recurrenceEndDate}T23:59:59.999Z`
		).toISOString()
	}
	return payload
}
