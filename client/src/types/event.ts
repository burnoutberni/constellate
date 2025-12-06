export type EventVisibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE' | 'UNLISTED'

export interface EventUser {
    id: string
    username: string
    name?: string | null
    displayColor?: string
    profileImage?: string | null
    isRemote: boolean
}

export type RecurrencePattern = 'DAILY' | 'WEEKLY' | 'MONTHLY'

export interface SharedEventSummary {
    id: string
    title: string
    summary?: string | null
    location?: string | null
    url?: string | null
    headerImage?: string | null
    startTime: string
    endTime?: string | null
    visibility?: EventVisibility
    user?: EventUser
}

export interface Event {
    id: string
    title: string
    summary?: string | null
    location?: string | null
    url?: string | null
    headerImage?: string | null
    startTime: string
    endTime?: string | null
    user?: EventUser
    userId?: string
    visibility?: EventVisibility
    eventStatus?: string | null
    eventAttendanceMode?: string | null
    maximumAttendeeCapacity?: number | null
    recurrencePattern?: RecurrencePattern | null
    recurrenceEndDate?: string | null
    originalEventId?: string | null
    tags: Array<{
        id: string
        tag: string
    }>
    _count?: {
        attendance: number
        likes: number
        comments: number
    }
    sharedEvent?: SharedEventSummary | null
}

/**
 * EventDetail extends Event and includes all fields from Event (including tags, _count, etc.)
 * plus additional detail fields like attendance, likes, and comments.
 */
export interface EventDetail extends Event {
    attendance: Array<{
        status: string
        user: EventUser
    }>
    likes: Array<{
        user: EventUser
    }>
    comments: Array<CommentWithMentions>
    userHasShared?: boolean
}

export interface CommentMention {
    id: string
    handle: string
    user: EventUser
}

export interface CommentWithMentions {
    id: string
    content: string
    createdAt: string
    author: EventUser
    mentions?: CommentMention[]
    replies?: Array<CommentWithMentions>
}
