export interface User {
    id: string
    createdAt: string
    username: string
    name?: string | null
    email?: string | null
    displayColor: string
    bio?: string | null
    profileImage?: string | null
    headerImage?: string | null
    isRemote: boolean
    externalActorUrl?: string | null
    followersCount?: number
    followingCount?: number
    isAdmin?: boolean
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
