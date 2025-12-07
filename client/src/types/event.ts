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

export type ReminderStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED'

export interface EventReminder {
    id: string
    eventId: string
    userId: string
    minutesBeforeStart: number
    status: ReminderStatus
    remindAt: string
    createdAt: string
    updatedAt: string
    deliveredAt?: string | null
    lastAttemptAt?: string | null
    failureReason?: string | null
}

export interface SharedEventSummary {
    id: string
    title: string
    summary?: string | null
    location?: string | null
    url?: string | null
    headerImage?: string | null
    startTime: string
    endTime?: string | null
    timezone: string
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
    timezone: string
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
    trendingScore?: number
    trendingRank?: number
    trendingMetrics?: {
        likes: number
        comments: number
        attendance: number
    }
    sharedEvent?: SharedEventSummary | null
}

export interface EventRecommendationPayload {
    event: Event
    score: number
    reasons: string[]
    signals: {
        matchedTags: string[]
        followedOrganizer: boolean
        hostAffinity: boolean
        popularityScore: number
    }
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
    viewerReminders?: EventReminder[]
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
