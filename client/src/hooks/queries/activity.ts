import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../useAuth'
import type { Activity } from '@/types'

interface ActivityFeedResponse {
    activities: Activity[]
}

export function useActivityFeed() {
    const { user } = useAuth()

    return useQuery<ActivityFeedResponse>({
        queryKey: ['activity', 'feed'],
        queryFn: async () => {
            const response = await fetch('/api/activity/feed', {
                credentials: 'include',
            })
            if (!response.ok) {
                throw new Error('Failed to fetch activity feed')
            }
            return response.json()
        },
        enabled: Boolean(user), // Only fetch when user is logged in
        staleTime: 1000 * 30, // 30 seconds - activity feed should be relatively fresh
    })
}
