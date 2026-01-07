export interface SuggestedUser {
    id: string
    username: string
    name: string | null
    displayColor: string
    profileImage: string | null
    bio?: string | null
    _count?: {
        followers: number
        events: number
    }
}
