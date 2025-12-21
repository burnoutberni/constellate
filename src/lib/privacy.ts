/**
 * Privacy Helper Functions
 * Shared functions for checking profile privacy and access permissions
 */

import { getBaseUrl } from './activitypubHelpers.js'
import { prisma } from './prisma.js'

/**
 * Options for checking if a viewer can access a private profile
 */
export interface CanViewPrivateProfileOptions {
	/**
	 * The viewer's user ID (for local users or when checking by ID)
	 */
	viewerId?: string
	/**
	 * The viewer's actor URL (for ActivityPub requests or remote users)
	 */
	viewerActorUrl?: string
	/**
	 * The profile owner's user ID
	 */
	profileUserId: string
	/**
	 * Whether the profile owner is a remote user
	 */
	profileIsRemote: boolean
	/**
	 * The profile owner's external actor URL (if remote)
	 */
	profileExternalActorUrl: string | null
	/**
	 * The profile owner's username
	 */
	profileUsername: string
	/**
	 * Whether the profile is public (if true, always returns true)
	 */
	profileIsPublic?: boolean
}

/**
 * Builds the profile owner's actor URL
 */
function buildProfileActorUrl(
	profileIsRemote: boolean,
	profileExternalActorUrl: string | null,
	profileUsername: string
): string | null {
	if (profileIsRemote) {
		return profileExternalActorUrl
	}

	const baseUrl = getBaseUrl()
	return `${baseUrl}/users/${profileUsername}`
}

/**
 * Checks if the viewer is the profile owner
 */
function isViewerProfileOwner(
	viewerId: string | undefined,
	viewerActorUrl: string | undefined,
	profileUserId: string,
	profileActorUrl: string | null
): boolean {
	if (viewerId && viewerId === profileUserId) {
		return true
	}

	return Boolean(viewerActorUrl && viewerActorUrl === profileActorUrl)
}

/**
 * Resolves the viewer's user ID from their actor URL if needed
 */
async function resolveViewerId(
	viewerId: string | undefined,
	viewerActorUrl: string | undefined
): Promise<string | null> {
	if (viewerId) {
		return viewerId
	}

	if (!viewerActorUrl) {
		return null
	}

	const viewerUser = await prisma.user.findFirst({
		where: {
			OR: [
				{ externalActorUrl: viewerActorUrl },
				{ username: viewerActorUrl.split('/').pop() || '', isRemote: false },
			],
		},
		select: { id: true },
	})

	return viewerUser?.id ?? null
}

/**
 * Checks if a viewer can view a private profile.
 * Returns true if:
 * - The profile is public (if profileIsPublic is provided and true)
 * - The viewer is the profile owner
 * - The viewer is an accepted follower of the profile owner
 *
 * @param options - Options for the privacy check
 * @returns Promise<boolean> - True if the viewer can view the profile
 */
export async function canViewPrivateProfile(
	options: CanViewPrivateProfileOptions
): Promise<boolean> {
	const {
		viewerId,
		viewerActorUrl,
		profileUserId,
		profileIsRemote,
		profileExternalActorUrl,
		profileUsername,
		profileIsPublic,
	} = options

	// If profile is public, always allow access
	if (profileIsPublic) {
		return true
	}

	// If we have neither viewerId nor viewerActorUrl, deny access
	if (!viewerId && !viewerActorUrl) {
		return false
	}

	// Build the profile owner's actor URL
	// For remote users, we need a valid externalActorUrl
	if (profileIsRemote && !profileExternalActorUrl) {
		return false
	}

	const profileActorUrl = buildProfileActorUrl(
		profileIsRemote,
		profileExternalActorUrl,
		profileUsername
	)

	if (!profileActorUrl) {
		return false
	}

	// Check if viewer is the profile owner
	if (isViewerProfileOwner(viewerId, viewerActorUrl, profileUserId, profileActorUrl)) {
		return true
	}

	// Resolve viewer user ID from actor URL if needed
	const resolvedViewerId = await resolveViewerId(viewerId, viewerActorUrl)

	if (!resolvedViewerId) {
		return false
	}

	// Check if viewer is an accepted follower
	const following = await prisma.following.findFirst({
		where: {
			userId: resolvedViewerId,
			actorUrl: profileActorUrl,
			accepted: true,
		},
	})

	return Boolean(following)
}

