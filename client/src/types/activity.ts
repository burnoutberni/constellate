import { Event, EventUser } from './event'

type ActivityType = 'like' | 'rsvp' | 'comment' | 'event_created' | 'event_shared'

export interface Activity {
	id: string
	type: ActivityType
	createdAt: string
	user: EventUser
	event: Event
	sharedEvent?: Event
	// Additional data based on type
	data?: {
		status?: string // For RSVP: 'attending' | 'maybe'
		commentContent?: string // For comments
		sharedEventId?: string
		originalEventId?: string
	}
}
