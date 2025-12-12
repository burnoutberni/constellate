/**
 * Activity Builder Service
 * Centralized construction of ActivityPub activities
 */

import { randomUUID } from 'crypto'
import {
	ActivityType,
	ObjectType,
	ACTIVITYPUB_CONTEXTS,
	PUBLIC_COLLECTION,
} from '../constants/activitypub.js'
import { getBaseUrl } from '../lib/activitypubHelpers.js'
import type { Event, User, Comment } from '../generated/prisma/client.js'
import type {
	CreateActivity,
	UpdateActivity,
	DeleteActivity,
	FollowActivity,
	AcceptActivity,
	RejectActivity,
	LikeActivity,
	UndoActivity,
	AnnounceActivity,
	TentativeAcceptActivity,
} from '../lib/activitypubSchemas.js'

/**
 * Builds a Create activity for an event
 */
function buildVisibilityAddressing(
	visibility: Event['visibility'] | null | undefined,
	followersUrl: string
) {
	if (!visibility || visibility === 'PUBLIC') {
		return { to: [PUBLIC_COLLECTION], cc: [followersUrl] }
	}

	if (visibility === 'FOLLOWERS') {
		return { to: [followersUrl], cc: [] as string[] }
	}

	return { to: [] as string[], cc: [] as string[] }
}

export function buildCreateEventActivity(
	event: Event & { user: User | null },
	_userId: string
): CreateActivity {
	const baseUrl = getBaseUrl()
	const user = event.user!
	const actorUrl = `${baseUrl}/users/${user.username}`
	const eventUrl = `${baseUrl}/events/${event.id}`
	const followersUrl = `${baseUrl}/users/${user.username}/followers`

	const addressing = buildVisibilityAddressing(event.visibility, followersUrl)

	return {
		'@context': [...ACTIVITYPUB_CONTEXTS],
		id: `${actorUrl}/activities/${event.id}/create`,
		type: ActivityType.CREATE,
		actor: actorUrl,
		published: event.createdAt.toISOString(),
		to: addressing.to.length ? addressing.to : undefined,
		cc: addressing.cc.length ? addressing.cc : undefined,
		object: {
			type: ObjectType.EVENT,
			id: eventUrl,
			name: event.title,
			summary: event.summary || undefined,
			startTime: event.startTime.toISOString(),
			endTime: event.endTime?.toISOString(),
			duration: event.duration || undefined,
			location: event.location || undefined,
			url: event.url || undefined,
			attributedTo: actorUrl,
			published: event.createdAt.toISOString(),
			eventStatus: event.eventStatus || undefined,
			eventAttendanceMode: event.eventAttendanceMode || undefined,
			maximumAttendeeCapacity: event.maximumAttendeeCapacity || undefined,
			attachment: event.headerImage
				? [
						{
							type: ObjectType.IMAGE,
							url: event.headerImage,
						},
					]
				: undefined,
			to: addressing.to.length ? addressing.to : undefined,
			cc: addressing.cc.length ? addressing.cc : undefined,
		},
	}
}

/**
 * Builds an Update activity for an event
 *
 * Used when an event's details are modified (title, time, location, etc.).
 * Recipients should update their cached copy of the event with the new data.
 *
 * @param event - The updated event with user information
 * @param _userId - The ID of the user performing the update (currently unused)
 * @returns UpdateActivity - An ActivityPub Update activity containing the updated event
 *
 * @example
 * ```typescript
 * const activity = buildUpdateEventActivity(updatedEvent, userId)
 * // Sends to followers: "Alice updated the event 'Team Meeting'"
 * ```
 */
export function buildUpdateEventActivity(
	event: Event & { user: User | null },
	_userId: string
): UpdateActivity {
	const baseUrl = getBaseUrl()
	const user = event.user!
	const actorUrl = `${baseUrl}/users/${user.username}`
	const eventUrl = `${baseUrl}/events/${event.id}`
	const followersUrl = `${baseUrl}/users/${user.username}/followers`

	const addressing = buildVisibilityAddressing(event.visibility, followersUrl)

	return {
		'@context': [...ACTIVITYPUB_CONTEXTS],
		id: `${actorUrl}/activities/${event.id}/update-${randomUUID()}`,
		type: ActivityType.UPDATE,
		actor: actorUrl,
		published: new Date().toISOString(),
		to: addressing.to.length ? addressing.to : undefined,
		cc: addressing.cc.length ? addressing.cc : undefined,
		object: {
			type: ObjectType.EVENT,
			id: eventUrl,
			name: event.title,
			summary: event.summary || undefined,
			startTime: event.startTime.toISOString(),
			endTime: event.endTime?.toISOString(),
			duration: event.duration || undefined,
			location: event.location || undefined,
			url: event.url || undefined,
			attributedTo: actorUrl,
			updated: event.updatedAt.toISOString(),
			eventStatus: event.eventStatus || undefined,
			eventAttendanceMode: event.eventAttendanceMode || undefined,
			maximumAttendeeCapacity: event.maximumAttendeeCapacity || undefined,
			attachment: event.headerImage
				? [
						{
							type: ObjectType.IMAGE,
							url: event.headerImage,
						},
					]
				: undefined,
			to: addressing.to.length ? addressing.to : undefined,
			cc: addressing.cc.length ? addressing.cc : undefined,
		},
	}
}

/**
 * Builds a Delete activity for an event
 *
 * Used when an event is permanently deleted. Recipients should remove the event
 * from their cache and display. The object is a Tombstone indicating what was deleted.
 *
 * @param eventId - The ID of the event being deleted
 * @param user - The user performing the deletion (must be event creator)
 * @param visibility - The visibility level of the original event (for addressing)
 * @returns DeleteActivity - An ActivityPub Delete activity with a Tombstone object
 *
 * @example
 * ```typescript
 * const activity = buildDeleteEventActivity('event-123', user, 'PUBLIC')
 * // Sends to followers: "Alice deleted the event"
 * // Recipients remove event-123 from their cache
 * ```
 */
export function buildDeleteEventActivity(
	eventId: string,
	user: User,
	visibility?: Event['visibility'] | null
): DeleteActivity {
	const baseUrl = getBaseUrl()
	const actorUrl = `${baseUrl}/users/${user.username}`
	const eventUrl = `${baseUrl}/events/${eventId}`
	const followersUrl = `${baseUrl}/users/${user.username}/followers`

	const addressing = buildVisibilityAddressing(visibility ?? 'PUBLIC', followersUrl)

	return {
		'@context': [...ACTIVITYPUB_CONTEXTS],
		id: `${actorUrl}/activities/${eventId}/delete`,
		type: ActivityType.DELETE,
		actor: actorUrl,
		published: new Date().toISOString(),
		to: addressing.to.length ? addressing.to : undefined,
		cc: addressing.cc.length ? addressing.cc : undefined,
		object: {
			type: ObjectType.TOMBSTONE,
			id: eventUrl,
			formerType: ObjectType.EVENT,
			deleted: new Date().toISOString(),
		},
	}
}

/**
 * Builds a Follow activity
 */
export function buildFollowActivity(follower: User, targetActorUrl: string): FollowActivity {
	const baseUrl = getBaseUrl()
	const actorUrl = `${baseUrl}/users/${follower.username}`

	return {
		'@context': [...ACTIVITYPUB_CONTEXTS],
		id: `${actorUrl}/follows/${randomUUID()}`,
		type: ActivityType.FOLLOW,
		actor: actorUrl,
		object: targetActorUrl,
		published: new Date().toISOString(),
	}
}

/**
 * Builds an Accept activity for a Follow
 */
export function buildAcceptActivity(
	user: User,
	followActivity: FollowActivity | string
): AcceptActivity {
	const baseUrl = getBaseUrl()
	const actorUrl = `${baseUrl}/users/${user.username}`

	return {
		'@context': [...ACTIVITYPUB_CONTEXTS],
		id: `${actorUrl}/accepts/${randomUUID()}`,
		type: ActivityType.ACCEPT,
		actor: actorUrl,
		object: followActivity,
		published: new Date().toISOString(),
	}
}

/**
 * Builds a Reject activity for follow requests
 */
export function buildRejectFollowActivity(
	user: User,
	followActivity: FollowActivity | string
): RejectActivity {
	const baseUrl = getBaseUrl()
	const actorUrl = `${baseUrl}/users/${user.username}`

	return {
		'@context': [...ACTIVITYPUB_CONTEXTS],
		id: `${actorUrl}/rejects/${randomUUID()}`,
		type: ActivityType.REJECT,
		actor: actorUrl,
		object: followActivity,
		published: new Date().toISOString(),
	}
}

/**
 * Builds a Like activity for an event
 */
export function buildLikeActivity(
	user: User,
	eventUrl: string,
	eventAuthorUrl: string,
	eventAuthorFollowersUrl?: string,
	isPublic: boolean = true
): LikeActivity {
	const baseUrl = getBaseUrl()
	const actorUrl = `${baseUrl}/users/${user.username}`

	// Extract event ID from URL for unique activity ID
	const eventId = eventUrl.split('/').pop() || 'unknown'
	const activityId = randomUUID()
	const uniqueId = `${actorUrl}/likes/${eventId}-${activityId}`

	// Determine addressing based on event visibility
	const to = [eventAuthorUrl]
	const cc: string[] = []

	if (isPublic) {
		cc.push(PUBLIC_COLLECTION)
	}

	if (eventAuthorFollowersUrl) {
		cc.push(eventAuthorFollowersUrl)
	}

	return {
		'@context': [...ACTIVITYPUB_CONTEXTS],
		id: uniqueId,
		type: ActivityType.LIKE,
		actor: actorUrl,
		object: eventUrl,
		to,
		cc: cc.length > 0 ? cc : undefined,
		published: new Date().toISOString(),
	}
}

/**
 * Builds an Undo activity
 *
 * Used to reverse a previous activity. Common use cases:
 * - Undo Like: User unlikes an event they previously liked
 * - Undo Follow: User unfollows someone they were following
 * - Undo Accept/TentativeAccept/Reject: User changes their RSVP status
 * - Undo Announce: User unshares an event they previously shared
 *
 * Recipients should reverse the effects of the original activity.
 *
 * @param user - The user performing the undo (must be same as original actor)
 * @param originalActivity - The activity being undone (embedded in the Undo)
 * @returns UndoActivity - An ActivityPub Undo activity wrapping the original
 *
 * @example
 * ```typescript
 * const likeActivity = buildLikeActivity(user, eventUrl, ...)
 * // Later, user unlikes:
 * const undoActivity = buildUndoActivity(user, likeActivity)
 * // Sends to followers: "Alice undid their like of the event"
 * ```
 */
export function buildUndoActivity(
	user: User,
	originalActivity:
		| LikeActivity
		| FollowActivity
		| AnnounceActivity
		| TentativeAcceptActivity
		| AcceptActivity
		| RejectActivity
): UndoActivity {
	const baseUrl = getBaseUrl()
	const actorUrl = `${baseUrl}/users/${user.username}`

	// Use original activity's ID for uniqueness
	const originalId = originalActivity.id || 'unknown'
	const activityId = randomUUID()
	const uniqueId = `${actorUrl}/undo/${originalId}-${activityId}`

	// Preserve addressing from original activity
	const to = originalActivity.to
	const cc = originalActivity.cc

	return {
		'@context': [...ACTIVITYPUB_CONTEXTS],
		id: uniqueId,
		type: ActivityType.UNDO,
		actor: actorUrl,
		object: originalActivity,
		to,
		cc,
		published: new Date().toISOString(),
	}
}

/**
 * Builds a TentativeAccept activity for event attendance
 */
export function buildAttendingActivity(
	user: User,
	eventUrl: string,
	eventAuthorUrl: string,
	eventAuthorFollowersUrl?: string,
	userFollowersUrl?: string,
	isPublic: boolean = true
): AcceptActivity {
	const baseUrl = getBaseUrl()
	const actorUrl = `${baseUrl}/users/${user.username}`

	// Extract event ID from URL for unique activity ID
	const eventId = eventUrl.split('/').pop() || 'unknown'
	const activityId = randomUUID()
	const uniqueId = `${actorUrl}/accepts/${eventId}-${activityId}`

	// Determine addressing
	const to = [eventAuthorUrl]
	const cc: string[] = []

	if (isPublic) {
		cc.push(PUBLIC_COLLECTION)
	}

	if (eventAuthorFollowersUrl) {
		cc.push(eventAuthorFollowersUrl)
	}

	// Also include user's followers so they know the user is attending
	if (userFollowersUrl) {
		cc.push(userFollowersUrl)
	}

	return {
		'@context': [...ACTIVITYPUB_CONTEXTS],
		id: uniqueId,
		type: ActivityType.ACCEPT,
		actor: actorUrl,
		object: eventUrl,
		to,
		cc: cc.length > 0 ? cc : undefined,
		published: new Date().toISOString(),
	}
}

/**
 * Builds a Reject activity for event attendance (not attending)
 */
export function buildNotAttendingActivity(
	user: User,
	eventUrl: string,
	eventAuthorUrl: string,
	eventAuthorFollowersUrl?: string,
	userFollowersUrl?: string,
	isPublic: boolean = true
): RejectActivity {
	const baseUrl = getBaseUrl()
	const actorUrl = `${baseUrl}/users/${user.username}`

	// Extract event ID from URL for unique activity ID
	const eventId = eventUrl.split('/').pop() || 'unknown'
	const activityId = randomUUID()
	const uniqueId = `${actorUrl}/reject/${eventId}-${activityId}`

	// Determine addressing
	const to = [eventAuthorUrl]
	const cc: string[] = []

	if (isPublic) {
		cc.push(PUBLIC_COLLECTION)
	}

	if (eventAuthorFollowersUrl) {
		cc.push(eventAuthorFollowersUrl)
	}

	// Also include user's followers
	if (userFollowersUrl) {
		cc.push(userFollowersUrl)
	}

	return {
		'@context': [...ACTIVITYPUB_CONTEXTS],
		id: uniqueId,
		type: ActivityType.REJECT,
		actor: actorUrl,
		object: eventUrl,
		to,
		cc: cc.length > 0 ? cc : undefined,
		published: new Date().toISOString(),
	}
}

/**
 * Builds an Announce activity for "maybe" attendance
 */
export function buildMaybeAttendingActivity(
	user: User,
	eventUrl: string,
	eventAuthorUrl: string,
	eventAuthorFollowersUrl?: string,
	userFollowersUrl?: string,
	isPublic: boolean = true
): TentativeAcceptActivity {
	const baseUrl = getBaseUrl()
	const actorUrl = `${baseUrl}/users/${user.username}`

	// Extract event ID from URL for unique activity ID
	const eventId = eventUrl.split('/').pop() || 'unknown'
	const activityId = randomUUID()
	const uniqueId = `${actorUrl}/tentative-accept/${eventId}-${activityId}`

	// Determine addressing
	const to = [eventAuthorUrl]
	const cc: string[] = []

	if (isPublic) {
		cc.push(PUBLIC_COLLECTION)
	}

	if (eventAuthorFollowersUrl) {
		cc.push(eventAuthorFollowersUrl)
	}

	// Also include user's followers
	if (userFollowersUrl) {
		cc.push(userFollowersUrl)
	}

	return {
		'@context': [...ACTIVITYPUB_CONTEXTS],
		id: uniqueId,
		type: ActivityType.TENTATIVE_ACCEPT,
		actor: actorUrl,
		object: eventUrl,
		to,
		cc: cc.length > 0 ? cc : undefined,
		published: new Date().toISOString(),
	}
}

/**
 * Builds an Announce activity for sharing/reposting an event
 */
export function buildAnnounceEventActivity(
	user: User,
	eventUrl: string,
	visibility: Event['visibility'] | null | undefined,
	originalActorUrl?: string
): AnnounceActivity {
	const baseUrl = getBaseUrl()
	const actorUrl = `${baseUrl}/users/${user.username}`
	const followersUrl = `${baseUrl}/users/${user.username}/followers`

	const addressing = buildVisibilityAddressing(visibility, followersUrl)
	const cc = addressing.cc ? [...addressing.cc] : []

	if (originalActorUrl && !cc.includes(originalActorUrl)) {
		cc.push(originalActorUrl)
	}

	return {
		'@context': [...ACTIVITYPUB_CONTEXTS],
		id: `${actorUrl}/activities/share-${randomUUID()}`,
		type: ActivityType.ANNOUNCE,
		actor: actorUrl,
		object: eventUrl,
		to: addressing.to && addressing.to.length > 0 ? addressing.to : undefined,
		cc: cc.length > 0 ? cc : undefined,
		published: new Date().toISOString(),
	}
}

/**
 * Builds a Create activity for a comment (Note)
 */
export function buildCreateCommentActivity(
	comment: Comment & { author: User; event: Event },
	eventAuthorUrl: string,
	eventAuthorFollowersUrl?: string,
	parentCommentAuthorUrl?: string,
	isPublic: boolean = true
): CreateActivity {
	const baseUrl = getBaseUrl()
	const actorUrl = `${baseUrl}/users/${comment.author.username}`
	const commentUrl = `${baseUrl}/comments/${comment.id}`
	const eventUrl = comment.event.externalId || `${baseUrl}/events/${comment.eventId}`

	// Determine addressing
	const to: string[] = [eventAuthorUrl]
	const cc: string[] = []

	// Add parent comment author if replying
	if (parentCommentAuthorUrl && parentCommentAuthorUrl !== eventAuthorUrl) {
		to.push(parentCommentAuthorUrl)
	}

	if (isPublic) {
		cc.push(PUBLIC_COLLECTION)
	}

	if (eventAuthorFollowersUrl) {
		cc.push(eventAuthorFollowersUrl)
	}

	return {
		'@context': [...ACTIVITYPUB_CONTEXTS],
		id: `${actorUrl}/activities/comment-${comment.id}`,
		type: ActivityType.CREATE,
		actor: actorUrl,
		published: comment.createdAt.toISOString(),
		to,
		cc: cc.length > 0 ? cc : undefined,
		object: {
			type: ObjectType.NOTE,
			id: commentUrl,
			content: comment.content,
			attributedTo: actorUrl,
			inReplyTo: comment.inReplyToId
				? `${baseUrl}/comments/${comment.inReplyToId}`
				: eventUrl,
			published: comment.createdAt.toISOString(),
			to,
			cc: cc.length > 0 ? cc : undefined,
		},
	}
}

/**
 * Builds a Delete activity for a comment
 */
export function buildDeleteCommentActivity(
	comment: Comment & { author: User; event: Event },
	eventAuthorUrl: string,
	eventAuthorFollowersUrl?: string,
	parentCommentAuthorUrl?: string,
	isPublic: boolean = true
): DeleteActivity {
	const baseUrl = getBaseUrl()
	const actorUrl = `${baseUrl}/users/${comment.author.username}`
	const commentUrl = comment.externalId || `${baseUrl}/comments/${comment.id}`

	// Determine addressing (same as original comment)
	const to: string[] = [eventAuthorUrl]
	const cc: string[] = []

	// Add parent comment author if replying
	if (parentCommentAuthorUrl && parentCommentAuthorUrl !== eventAuthorUrl) {
		to.push(parentCommentAuthorUrl)
	}

	if (isPublic) {
		cc.push(PUBLIC_COLLECTION)
	}

	if (eventAuthorFollowersUrl) {
		cc.push(eventAuthorFollowersUrl)
	}

	return {
		'@context': [...ACTIVITYPUB_CONTEXTS],
		id: `${actorUrl}/activities/comment-${comment.id}/delete`,
		type: ActivityType.DELETE,
		actor: actorUrl,
		published: new Date().toISOString(),
		to,
		cc: cc.length > 0 ? cc : undefined,
		object: {
			type: ObjectType.TOMBSTONE,
			id: commentUrl,
			formerType: ObjectType.NOTE,
			deleted: new Date().toISOString(),
		},
	}
}

/**
 * Builds an Update activity for a user profile
 */
export function buildUpdateProfileActivity(user: User): UpdateActivity {
	const baseUrl = getBaseUrl()
	const actorUrl = `${baseUrl}/users/${user.username}`
	const followersUrl = `${baseUrl}/users/${user.username}/followers`

	return {
		'@context': [...ACTIVITYPUB_CONTEXTS],
		id: `${actorUrl}/updates/${randomUUID()}`,
		type: ActivityType.UPDATE,
		actor: actorUrl,
		published: new Date().toISOString(),
		to: [PUBLIC_COLLECTION],
		cc: [followersUrl],
		object: {
			type: ObjectType.PERSON,
			id: actorUrl,
			preferredUsername: user.username,
			name: user.name || user.username,
			summary: user.bio || undefined,
			displayColor: user.displayColor,
			icon: user.profileImage
				? {
						type: ObjectType.IMAGE,
						url: user.profileImage,
					}
				: undefined,
			image: user.headerImage
				? {
						type: ObjectType.IMAGE,
						url: user.headerImage,
					}
				: undefined,
			inbox: `${actorUrl}/inbox`,
			outbox: `${actorUrl}/outbox`,
			followers: followersUrl,
			following: `${baseUrl}/users/${user.username}/following`,
			publicKey: {
				id: `${actorUrl}#main-key`,
				owner: actorUrl,
				publicKeyPem: user.publicKey!,
			},
			endpoints: {
				sharedInbox: `${baseUrl}/inbox`,
			},
		},
	}
}
