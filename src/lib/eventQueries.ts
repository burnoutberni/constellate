import type { Prisma } from '@prisma/client'

interface EventFilterOptions {
	onlyMine?: boolean
	userId?: string
}

/**
 * Builds a Prisma where clause for filtering events based on user preferences.
 * Specifically handles the "onlyMine" logic which includes:
 * 1. Events the user has explicitly RSVP'd to (attending or maybe)
 * 2. Events the user is organizing, UNLESS they have explicitly set their attendance to 'not_attending'
 */
export function buildEventFilter(
	options: EventFilterOptions,
	userId?: string
): Prisma.EventWhereInput {
	const filters: Prisma.EventWhereInput[] = []

	if (options.onlyMine) {
		if (userId) {
			filters.push({
				OR: [
					// 1. Explicitly attending or maybe (covers both organizers and regular users who RSVP'd)
					{
						attendance: {
							some: {
								userId: userId,
								status: { in: ['attending', 'maybe'] },
							},
						},
					},
					// 2. Organizer with NO attendance record (legacy data compatibility)
					// If an organizer creates an event, they might not have an attendance record yet (legacy).
					// If they explicitly set status to 'not_attending', the above clause fails AND this clause fails (attendance is not none),
					// so the event is correctly excluded.
					{
						userId: userId,
						attendance: {
							none: {
								userId: userId,
							},
						},
					},
				],
			})
		} else {
			// requested "only mine" but not logged in -> return nothing
			// Using a condition that never matches
			filters.push({ id: '__impossible_id__' })
		}
	}

	if (filters.length === 0) {
		return {}
	}

	return { AND: filters }
}
