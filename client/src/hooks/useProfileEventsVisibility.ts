/**
 * Custom hook to determine visibility of events section based on profile privacy settings
 *
 * Determines whether to show:
 * - Private profile message (when profile is private, not own profile, and not following)
 * - Events list (when profile is public, own profile, or user is following)
 *
 * @param isPublicProfile - Whether the profile is public
 * @param isOwnProfile - Whether the current user owns this profile
 * @param isFollowing - Whether the current user is following this profile
 * @returns Object with visibility flags for private message and events list
 */
export function useProfileEventsVisibility(
	isPublicProfile: boolean | undefined,
	isOwnProfile: boolean,
	isFollowing: boolean | undefined
) {
	// Show private message if profile is private AND not own profile AND not following
	const showPrivateMessage = isPublicProfile === false && !isOwnProfile && !isFollowing

	// Show events if profile is public OR own profile OR user is following
	const showEvents = isPublicProfile !== false || isOwnProfile || isFollowing

	return {
		showPrivateMessage,
		showEvents,
	}
}

