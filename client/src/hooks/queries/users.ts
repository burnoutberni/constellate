import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { useMutationErrorHandler } from '@/hooks/useErrorHandler'
import { api } from '@/lib/api-client'
import type { UserProfile, FollowStatus, Event, SuggestedUser } from '@/types'

import { queryKeys } from './keys'

interface UserProfileResponse {
	user: UserProfile
	events: Event[]
}

// Queries
export function useUserProfile(username: string) {
	return useQuery<UserProfileResponse>({
		queryKey: queryKeys.users.profile(username),
		queryFn: () =>
			api.get<UserProfileResponse>(
				`/user-search/profile/${encodeURIComponent(username)}`,
				undefined,
				undefined,
				'Failed to fetch profile'
			),
		enabled: Boolean(username),
	})
}

export function useCurrentUserProfile(userId?: string | null) {
	return useQuery<UserProfile | null>({
		queryKey: queryKeys.users.currentProfile(userId),
		queryFn: async () => {
			if (!userId) {
				return null
			}
			return api.get<UserProfile>(
				'/users/me/profile',
				undefined,
				undefined,
				'Failed to fetch profile'
			)
		},
		enabled: Boolean(userId),
	})
}

export function useFollowStatus(username: string) {
	return useQuery<FollowStatus>({
		queryKey: queryKeys.users.followStatus(username),
		queryFn: () =>
			api.get<FollowStatus>(
				`/users/${encodeURIComponent(username)}/follow-status`,
				undefined,
				undefined,
				'Failed to fetch follow status'
			),
		enabled: Boolean(username),
	})
}

export function useSuggestedUsers(limit = 5, options?: { enabled?: boolean }) {
	return useQuery<SuggestedUser[]>({
		queryKey: ['users', 'suggestions', limit],
		enabled: options?.enabled ?? true,
		queryFn: () =>
			api.get<SuggestedUser[]>(
				'/user-search/suggestions',
				{ limit },
				undefined,
				'Failed to fetch user suggestions'
			),
		staleTime: 1000 * 60 * 5, // 5 minutes
	})
}

// Mutations
export function useFollowUser(username: string) {
	const queryClient = useQueryClient()
	const handleMutationError = useMutationErrorHandler()

	return useMutation({
		mutationFn: () =>
			api.post(
				`/users/${encodeURIComponent(username)}/follow`,
				undefined,
				undefined,
				'Failed to follow user'
			),
		onMutate: async () => {
			// Optimistic update
			await queryClient.cancelQueries({
				queryKey: queryKeys.users.profile(username),
			})
			await queryClient.cancelQueries({
				queryKey: queryKeys.users.followStatus(username),
			})

			const previousProfile = queryClient.getQueryData<UserProfileResponse>(
				queryKeys.users.profile(username)
			)
			const previousStatus = queryClient.getQueryData<FollowStatus>(
				queryKeys.users.followStatus(username)
			)

			// Only optimistically update follower count for local users
			// For remote users, we'll get the accurate count from the SSE event
			if (previousProfile && !previousProfile.user.isRemote && previousProfile.user._count) {
				queryClient.setQueryData<UserProfileResponse>(queryKeys.users.profile(username), {
					...previousProfile,
					user: {
						...previousProfile.user,
						_count: {
							...previousProfile.user._count,
							followers: (previousProfile.user._count.followers || 0) + 1,
						},
					},
				})
			}

			// Optimistically update follow status to pending
			queryClient.setQueryData<FollowStatus>(queryKeys.users.followStatus(username), {
				isFollowing: true,
				isAccepted: false,
			})

			return { previousProfile, previousStatus }
		},
		onError: (error, _variables, context) => {
			// Rollback on error
			if (context?.previousProfile) {
				queryClient.setQueryData(queryKeys.users.profile(username), context.previousProfile)
			}
			if (context?.previousStatus) {
				queryClient.setQueryData(
					queryKeys.users.followStatus(username),
					context.previousStatus
				)
			}
			// Handle error with user-friendly message
			handleMutationError(error, 'Failed to follow user')
		},
		onSuccess: () => {
			// Invalidate to get fresh data
			queryClient.invalidateQueries({
				queryKey: queryKeys.users.profile(username),
			})
			queryClient.invalidateQueries({
				queryKey: queryKeys.users.followStatus(username),
			})
		},
	})
}

export function useUnfollowUser(username: string) {
	const queryClient = useQueryClient()
	const handleMutationError = useMutationErrorHandler()

	return useMutation({
		mutationFn: () =>
			api.delete(
				`/users/${encodeURIComponent(username)}/follow`,
				undefined,
				'Failed to unfollow user'
			),
		onMutate: async () => {
			// Optimistic update
			await queryClient.cancelQueries({
				queryKey: queryKeys.users.profile(username),
			})
			await queryClient.cancelQueries({
				queryKey: queryKeys.users.followStatus(username),
			})

			const previousProfile = queryClient.getQueryData<UserProfileResponse>(
				queryKeys.users.profile(username)
			)
			const previousStatus = queryClient.getQueryData<FollowStatus>(
				queryKeys.users.followStatus(username)
			)

			// Only optimistically update follower count for local users
			// For remote users, we'll get the accurate count from the SSE event
			if (previousProfile && !previousProfile.user.isRemote && previousProfile.user._count) {
				queryClient.setQueryData<UserProfileResponse>(queryKeys.users.profile(username), {
					...previousProfile,
					user: {
						...previousProfile.user,
						_count: {
							...previousProfile.user._count,
							followers: Math.max(
								0,
								(previousProfile.user._count.followers || 0) - 1
							),
						},
					},
				})
			}

			// Optimistically update follow status
			queryClient.setQueryData<FollowStatus>(queryKeys.users.followStatus(username), {
				isFollowing: false,
				isAccepted: false,
			})

			return { previousProfile, previousStatus }
		},
		onError: (error, _variables, context) => {
			// Rollback on error
			if (context?.previousProfile) {
				queryClient.setQueryData(queryKeys.users.profile(username), context.previousProfile)
			}
			if (context?.previousStatus) {
				queryClient.setQueryData(
					queryKeys.users.followStatus(username),
					context.previousStatus
				)
			}
			// Handle error with user-friendly message
			handleMutationError(error, 'Failed to unfollow user')
		},
		onSuccess: () => {
			// Invalidate to get fresh data
			queryClient.invalidateQueries({
				queryKey: queryKeys.users.profile(username),
			})
			queryClient.invalidateQueries({
				queryKey: queryKeys.users.followStatus(username),
			})
		},
	})
}
