export const queryKeys = {
    events: {
        list: (limit: number) => ['events', 'list', limit] as const,
        detail: (username: string, eventId: string) => ['events', 'detail', username, eventId] as const,
        lists: () => ['events', 'list'] as const,
        details: () => ['events', 'detail'] as const,
        recommendations: (limit: number) => ['events', 'recommendations', limit] as const,
        trending: (limit: number, windowDays: number) => ['events', 'trending', limit, windowDays] as const,
        search: (filters: Record<string, unknown> | undefined, page: number, limit: number) => ['events', 'search', filters ?? {}, page, limit] as const,
    },
    search: {
        events: (params: { filters: Record<string, unknown>; page: number; limit: number }) =>
            ['search', 'events', params] as const,
    },
    users: {
        profile: (username: string) => ['users', 'profile', username] as const,
        followStatus: (username: string) => ['users', 'followStatus', username] as const,
        currentProfile: (userId?: string | null) => ['users', 'current', 'profile', userId ?? null] as const,
    },
    activity: {
        feed: () => ['activity', 'feed'] as const,
    },
    notifications: {
        all: () => ['notifications'] as const,
        list: (limit: number) => ['notifications', 'list', limit] as const,
    },
} as const

