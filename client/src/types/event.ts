

export interface EventUser {
    id: string
    username: string
    name?: string | null
    displayColor?: string
    profileImage?: string | null
    isRemote: boolean
}

export type RecurrencePattern = 'DAILY' | 'WEEKLY' | 'MONTHLY'

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
    eventStatus?: string | null
    eventAttendanceMode?: string | null
    maximumAttendeeCapacity?: number | null
    recurrencePattern?: RecurrencePattern | null
    recurrenceEndDate?: string | null
    originalEventId?: string | null
    _count?: {
        attendance: number
        likes: number
        comments: number
    }
}

export interface EventDetail extends Event {
    attendance: Array<{
        status: string
        user: EventUser
    }>
    likes: Array<{
        user: EventUser
    }>
    comments: Array<{
        id: string
        content: string
        createdAt: string
        author: EventUser
        replies?: Array<{
            id: string
            content: string
            createdAt: string
            author: EventUser
        }>
    }>
    tags: Array<{
        tag: string
    }>
}
