import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './keys'
import type { UserProfile, FollowStatus, Event } from '@/types'

interface UserProfileResponse {
    user: UserProfile
    events: Event[]
}

// Queries
export function useUserProfile(username: string) {
    return useQuery<UserProfileResponse>({
        queryKey: queryKeys.users.profile(username),
        queryFn: async () => {
            const response = await fetch(
                `/api/user-search/profile/${encodeURIComponent(username)}`,
                {
                    credentials: 'include',
                },
            )

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('User not found')
                }
                throw new Error('Failed to fetch profile')
            }

            return response.json()
        },
        enabled: Boolean(username),
    })
}

export function useFollowStatus(username: string) {
    return useQuery<FollowStatus>({
        queryKey: queryKeys.users.followStatus(username),
        queryFn: async () => {
            const response = await fetch(
                `/api/users/${encodeURIComponent(username)}/follow-status`,
                {
                    credentials: 'include',
                },
            )

            if (!response.ok) {
                throw new Error('Failed to fetch follow status')
            }

            return response.json()
        },
        enabled: Boolean(username),
    })
}

// Mutations
export function useFollowUser(username: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async () => {
            const response = await fetch(
                `/api/users/${encodeURIComponent(username)}/follow`,
                {
                    method: 'POST',
                    credentials: 'include',
                },
            )

            if (!response.ok) {
                const error = await response.json().catch(() => ({
                    error: 'Failed to follow user',
                }))
                throw new Error(error.error || 'Failed to follow user')
            }

            return response.json()
        },
        onMutate: async () => {
            // Optimistic update
            await queryClient.cancelQueries({
                queryKey: queryKeys.users.profile(username),
            })
            await queryClient.cancelQueries({
                queryKey: queryKeys.users.followStatus(username),
            })

            const previousProfile = queryClient.getQueryData<UserProfileResponse>(
                queryKeys.users.profile(username),
            )
            const previousStatus = queryClient.getQueryData<FollowStatus>(
                queryKeys.users.followStatus(username),
            )

            // Only optimistically update follower count for local users
            // For remote users, we'll get the accurate count from the SSE event
            if (previousProfile && !previousProfile.user.isRemote && previousProfile.user._count) {
                queryClient.setQueryData<UserProfileResponse>(
                    queryKeys.users.profile(username),
                    {
                        ...previousProfile,
                        user: {
                            ...previousProfile.user,
                            _count: {
                                ...previousProfile.user._count,
                                followers:
                                    (previousProfile.user._count.followers || 0) + 1,
                            },
                        },
                    },
                )
            }

            // Optimistically update follow status to pending
            queryClient.setQueryData<FollowStatus>(
                queryKeys.users.followStatus(username),
                { isFollowing: true, isAccepted: false },
            )

            return { previousProfile, previousStatus }
        },
        onError: (_err, _variables, context) => {
            // Rollback on error
            if (context?.previousProfile) {
                queryClient.setQueryData(
                    queryKeys.users.profile(username),
                    context.previousProfile,
                )
            }
            if (context?.previousStatus) {
                queryClient.setQueryData(
                    queryKeys.users.followStatus(username),
                    context.previousStatus,
                )
            }
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

    return useMutation({
        mutationFn: async () => {
            const response = await fetch(
                `/api/users/${encodeURIComponent(username)}/follow`,
                {
                    method: 'DELETE',
                    credentials: 'include',
                },
            )

            if (!response.ok) {
                const error = await response.json().catch(() => ({
                    error: 'Failed to unfollow user',
                }))
                throw new Error(error.error || 'Failed to unfollow user')
            }

            return response.json()
        },
        onMutate: async () => {
            // Optimistic update
            await queryClient.cancelQueries({
                queryKey: queryKeys.users.profile(username),
            })
            await queryClient.cancelQueries({
                queryKey: queryKeys.users.followStatus(username),
            })

            const previousProfile = queryClient.getQueryData<UserProfileResponse>(
                queryKeys.users.profile(username),
            )
            const previousStatus = queryClient.getQueryData<FollowStatus>(
                queryKeys.users.followStatus(username),
            )

            // Only optimistically update follower count for local users
            // For remote users, we'll get the accurate count from the SSE event
            if (previousProfile && !previousProfile.user.isRemote && previousProfile.user._count) {
                queryClient.setQueryData<UserProfileResponse>(
                    queryKeys.users.profile(username),
                    {
                        ...previousProfile,
                        user: {
                            ...previousProfile.user,
                            _count: {
                                ...previousProfile.user._count,
                                followers: Math.max(
                                    0,
                                    (previousProfile.user._count.followers || 0) - 1,
                                ),
                            },
                        },
                    },
                )
            }

            // Optimistically update follow status
            queryClient.setQueryData<FollowStatus>(
                queryKeys.users.followStatus(username),
                { isFollowing: false, isAccepted: false },
            )

            return { previousProfile, previousStatus }
        },
        onError: (_err, _variables, context) => {
            // Rollback on error
            if (context?.previousProfile) {
                queryClient.setQueryData(
                    queryKeys.users.profile(username),
                    context.previousProfile,
                )
            }
            if (context?.previousStatus) {
                queryClient.setQueryData(
                    queryKeys.users.followStatus(username),
                    context.previousStatus,
                )
            }
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
