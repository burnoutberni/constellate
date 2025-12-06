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
        all: () => ['notifications'] as const,
        list: (limit: number) => ['notifications', 'list', limit] as const,
    },
} as const

