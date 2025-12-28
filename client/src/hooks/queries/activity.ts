import { useInfiniteQuery } from '@tanstack/react-query'

import { api } from '@/lib/api-client'

import { useAuth } from '../useAuth'

import { queryKeys } from './keys'

// Define the unified FeedItem type ( mirroring backend FeedItem )
export type FeedItemType = 'activity' | 'trending_event' | 'suggested_users' | 'onboarding'

export interface FeedItem {
	type: FeedItemType
	id: string
	timestamp: string
	data: unknown // Typed more specifically in components using guards
}

interface FeedResponse {
	items: FeedItem[]
	nextCursor?: string
}

export function useActivityFeed() {
	const { user } = useAuth()

	return useInfiniteQuery<FeedResponse>({
		queryKey: queryKeys.activity.feed(),
		queryFn: ({ pageParam }) =>
			api.get<FeedResponse>(
				'/activity/feed',
				{
					cursor: pageParam as string | undefined,
					limit: 20
				},
				undefined,
				'Failed to fetch activity feed'
			),
		initialPageParam: undefined,
		getNextPageParam: (lastPage) => lastPage.nextCursor,
		enabled: Boolean(user),
		staleTime: 1000 * 60, // 1 minute
	})
}
