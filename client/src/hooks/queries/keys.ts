export const queryKeys = {
    events: {
        list: (limit: number) => ['events', 'list', limit] as const,
        detail: (username: string | undefined | null, eventId: string) =>
            ['events', 'detail', username, eventId] as const,
        lists: () => ['events', 'list'] as const,
        details: () => ['events', 'detail'] as const,
        recommendations: (limit: number) => ['events', 'recommendations', limit] as const,
        trending: (limit: number, windowDays: number) =>
            ['events', 'trending', limit, windowDays] as const,
        nearby: (latitude?: number, longitude?: number, radiusKm: number = 25) =>
            ['events', 'nearby', latitude ?? null, longitude ?? null, radiusKm] as const,
    },
    search: {
        events: (params: { filters: Record<string, unknown>; page: number; limit: number }) =>
            ['search', 'events', params] as const,
    },
    users: {
        profile: (username: string) => ['users', 'profile', username] as const,
        followStatus: (username: string) => ['users', 'followStatus', username] as const,
        currentProfile: (userId?: string | null) =>
            ['users', 'current', 'profile', userId ?? null] as const,
        followers: (username: string) => ['users', 'followers', username] as const,
        following: (username: string) => ['users', 'following', username] as const,
    },
    activity: {
        feed: () => ['activity', 'feed'] as const,
        home: () => ['activity', 'home'] as const,
    },
    notifications: {
        all: () => ['notifications'] as const,
        list: (limit: number) => ['notifications', 'list', limit] as const,
    },
    emailPreferences: {
        all: () => ['emailPreferences'] as const,
        deliveries: (limit: number, offset: number) =>
            ['emailPreferences', 'deliveries', limit, offset] as const,
    },
    reminders: {
        list: () => ['reminders', 'list'] as const,
    },
    instances: {
        all: () => ['instances'] as const,
        list: (params: {
            limit?: number
            offset?: number
            sortBy?: string
            includeBlocked?: boolean
        }) => ['instances', 'list', params] as const,
        search: (query: string, limit?: number) => ['instances', 'search', query, limit] as const,
        detail: (domain: string) => ['instances', 'detail', domain] as const,
        events: (domain: string, limit: number, offset: number, time?: string) =>
            ['instances', 'events', domain, limit, offset, time ?? 'all'] as const,
    },
    admin: {
        users: () => ['admin', 'users'] as const,
        apiKeys: () => ['admin', 'api-keys'] as const,
        instances: () => ['admin', 'instances'] as const,
    },
    templates: {
        list: (userId?: string | null) => ['templates', userId ?? null] as const,
    },
    followers: {
        pending: () => ['followers', 'pending'] as const,
    },
    platform: {
        stats: () => ['platform', 'stats'] as const,
    },
} as const
