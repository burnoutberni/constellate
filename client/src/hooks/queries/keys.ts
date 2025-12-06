export const queryKeys = {
    events: {
        list: (limit: number) => ['events', 'list', limit] as const,
        detail: (username: string, eventId: string) => ['events', 'detail', username, eventId] as const,
        lists: () => ['events', 'list'] as const,
        details: () => ['events', 'detail'] as const,
    },
    users: {
        profile: (username: string) => ['users', 'profile', username] as const,
        followStatus: (username: string) => ['users', 'followStatus', username] as const,
    },
    activity: {
        feed: () => ['activity', 'feed'] as const,
    },
    notifications: {
        list: (params: { limit?: number; type?: string; includeRead?: boolean } = {}) =>
            ['notifications', 'list', params] as const,
        lists: () => ['notifications', 'list'] as const,
        summary: () => ['notifications', 'summary'] as const,
    },
} as const

