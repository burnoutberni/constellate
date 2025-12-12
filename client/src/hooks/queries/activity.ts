import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api-client'
import type { Activity } from '@/types'

import { useAuth } from '../useAuth'

import { queryKeys } from './keys'

interface ActivityFeedResponse {
	activities: Activity[]
}

export function useActivityFeed() {
	const { user } = useAuth()

	return useQuery<ActivityFeedResponse>({
		queryKey: queryKeys.activity.feed(),
		queryFn: () =>
			api.get<ActivityFeedResponse>(
				'/activity/feed',
				undefined,
				undefined,
				'Failed to fetch activity feed'
			),
		enabled: Boolean(user), // Only fetch when user is logged in
		staleTime: 1000 * 30, // 30 seconds - activity feed should be relatively fresh
	})
}
