export interface User {
	id: string
	createdAt: string
	username: string
	name?: string | null
	email?: string | null
	displayColor: string
	timezone: string
	bio?: string | null
	profileImage?: string | null
	headerImage?: string | null
	isRemote: boolean
	externalActorUrl?: string | null
	followersCount?: number
	followingCount?: number
	isAdmin?: boolean
	autoAcceptFollowers?: boolean
	isPublicProfile?: boolean
}

export interface UserProfile extends User {
	_count?: {
		followers: number
		following: number
		events: number
	}
}

export interface FollowStatus {
	isFollowing: boolean
	isAccepted: boolean
}
