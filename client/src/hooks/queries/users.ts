import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { useMutationErrorHandler } from '@/hooks/useErrorHandler'
import { api } from '@/lib/api-client'
import type { UserProfile, FollowStatus, Event, SuggestedUser, User } from '@/types'

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
		staleTime: 1000 * 60 * 5,
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

interface FollowMutationVariables {
	currentUser?: Partial<User> | null
}

interface UnfollowMutationVariables {
	currentUser?: Partial<User> | null
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
		onMutate: async (variables?: FollowMutationVariables) => {
			// Optimistic update - only for follow status, not for counts
			// Counts will be updated via SSE when the follow is accepted
			await queryClient.cancelQueries({
				queryKey: queryKeys.users.followStatus(username),
			})

			const previousStatus = queryClient.getQueryData<FollowStatus>(
				queryKeys.users.followStatus(username)
			)

			// Optimistically update follow status to pending
			queryClient.setQueryData<FollowStatus>(queryKeys.users.followStatus(username), {
				isFollowing: true,
				isAccepted: false,
			})

			// Optimistically add current user to the target's followers list
			const followersQueryKey = queryKeys.users.followers(username)
			const currentFollowersData = queryClient.getQueryData<{
				followers?: (User & { isPending?: boolean; isFollowing?: boolean })[]
				following?: User[]
				isRemote?: boolean
				remoteNote?: string | null
			}>(followersQueryKey)

			let previousFollowersData = null
			if (currentFollowersData?.followers) {
				const currentUser = variables?.currentUser ?? await getCurrentUserFromCache(queryClient)

				if (currentUser && currentUser.id && currentUser.username && !currentUser.isRemote) {
					previousFollowersData = currentFollowersData
					// Add current user as pending follower at the top of the list
					const optimisticCurrentUser: User & { isPending: true; isFollowing: false; isRemote: false } = {
						id: currentUser.id,
						username: currentUser.username,
						name: currentUser.name ?? undefined,
						profileImage: currentUser.profileImage ?? undefined,
						displayColor: currentUser.displayColor ?? '#3b82f6',
						createdAt: currentUser.createdAt ?? new Date().toISOString(),
						isRemote: false,
						isPublicProfile: currentUser.isPublicProfile ?? true,
						isPending: true,
						isFollowing: false,
					}
					queryClient.setQueryData(followersQueryKey, {
						...currentFollowersData,
						followers: [optimisticCurrentUser, ...(currentFollowersData.followers || [])],
					})
				}
			}

			return { previousStatus, previousFollowersData }
		},
		onError: (error, _variables, context) => {
			// Rollback on error
			if (context?.previousStatus) {
				queryClient.setQueryData(
					queryKeys.users.followStatus(username),
					context.previousStatus
				)
			}
			// Rollback followers list
			if (context?.previousFollowersData) {
				queryClient.setQueryData(
					queryKeys.users.followers(username),
					context.previousFollowersData
				)
			}
			// Handle error with user-friendly message
			handleMutationError(error, 'Failed to follow user')
		},
		onSuccess: () => {
			// Invalidate to get fresh data (SSE will also update cache, but invalidation ensures consistency)
			queryClient.invalidateQueries({ queryKey: queryKeys.users.profile(username) })
			queryClient.invalidateQueries({ queryKey: queryKeys.users.followStatus(username) })
			// Invalidate followers list to show the pending follower
			queryClient.invalidateQueries({ queryKey: queryKeys.users.followers(username) })
			// Also invalidate suggestions to remove the followed user
			queryClient.invalidateQueries({ queryKey: ['users', 'suggestions'] })
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
		onMutate: async (variables?: UnfollowMutationVariables) => {
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

			// Optimistically remove current user from the target's followers list if pending
			const followersQueryKey = queryKeys.users.followers(username)
			const currentFollowersData = queryClient.getQueryData<{
				followers?: (User & { isPending?: boolean; isFollowing?: boolean })[]
				following?: User[]
				isRemote?: boolean
				remoteNote?: string | null
			}>(followersQueryKey)

			let previousFollowersData = null
			if (currentFollowersData?.followers) {
				const currentUser = variables?.currentUser ?? await getCurrentUserFromCache(queryClient)

				if (currentUser?.id) {
					previousFollowersData = currentFollowersData
					// Remove current user from followers list if they were pending
					const filteredFollowers = currentFollowersData.followers?.filter(
						(f) => f.id !== currentUser.id
					)
					queryClient.setQueryData(followersQueryKey, {
						...currentFollowersData,
						followers: filteredFollowers,
					})
				}
			}

			return { previousProfile, previousStatus, previousFollowersData }
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
			// Rollback followers list
			if (context?.previousFollowersData) {
				queryClient.setQueryData(
					queryKeys.users.followers(username),
					context.previousFollowersData
				)
			}
			// Handle error with user-friendly message
			handleMutationError(error, 'Failed to unfollow user')
		},
		onSuccess: () => {
			// Invalidate to ensure UI updates
			queryClient.invalidateQueries({ queryKey: queryKeys.users.profile(username) })
			queryClient.invalidateQueries({ queryKey: queryKeys.users.followStatus(username) })
			queryClient.invalidateQueries({ queryKey: queryKeys.users.followers(username) })
			queryClient.invalidateQueries({ queryKey: queryKeys.users.following(username) })
			// Also invalidate user-search queries used by FollowersModal/FollowingModal
			queryClient.invalidateQueries({ queryKey: ['users', 'followers', username] })
			queryClient.invalidateQueries({ queryKey: ['users', 'following', username] })
		},
	})
}

async function getCurrentUserFromCache(queryClient: ReturnType<typeof useQueryClient>): Promise<User | null> {
	// Note: This implementation relies on the internal structure of query keys.
	// Specifically, it looks for keys matching ['users', 'current', 'profile', <userId>].
	// This is fragile because if the query key structure changes in queryKeys.ts,
	// this function will break silently.
	//
	// A more robust approach would be to use a shared context or Zustand store
	// to access the current user data, but that would require more significant refactoring.
	// For now, we access the cache directly to avoid duplicating user state.
	const queries = queryClient.getQueriesData<UserProfile>({
		queryKey: ['users', 'current', 'profile'],
		exact: false,
	})
	const currentUserQuery = queries.find(([key]) => {
		if (Array.isArray(key) && key.length >= 4 && key[1] === 'current' && key[2] === 'profile') {
			return key[3] !== null
		}
		return false
	})
	return (currentUserQuery?.[1] as User | null) ?? null
}
