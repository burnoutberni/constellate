import { useLocation } from 'react-router-dom'
import { UserProfilePage } from './UserProfilePage'
import { EventDetailPage } from './EventDetailPage'

/**
 * Smart router that determines whether to show a user profile or event detail
 * based on the URL structure:
 * - /@username -> UserProfilePage
 * - /@username/eventId -> EventDetailPage
 */
export function ProfileOrEventPage() {
	const location = useLocation()

	// Check if path starts with /@
	if (!location.pathname.startsWith('/@')) {
		return <div>Not found</div>
	}

	// Extract path parts
	const pathParts = location.pathname.split('/').filter(Boolean)

	// If there are 2 parts (e.g., [@username, eventId]), it's an event
	if (pathParts.length >= 2) {
		return <EventDetailPage />
	}

	// Otherwise, it's a profile
	return <UserProfilePage />
}
