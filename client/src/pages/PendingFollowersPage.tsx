import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/hooks/queries'
import type { User } from '@/types'
import { useThemeColors } from '@/design-system'

interface PendingFollower extends User {
    followerId: string
    createdAt: string
}

export function PendingFollowersPage() {
    const colors = useThemeColors()
    const { user, logout } = useAuth()
    const queryClient = useQueryClient()

    const { data, isLoading, error } = useQuery<{ followers: PendingFollower[] }>({
        queryKey: ['pendingFollowers'],
        queryFn: async () => {
            const response = await fetch('/api/followers/pending', {
                credentials: 'include',
            })
            if (!response.ok) {
                throw new Error('Failed to fetch pending followers')
            }
            return response.json()
        },
    })

    const acceptMutation = useMutation({
        mutationFn: async (followerId: string) => {
            const response = await fetch(`/api/followers/${followerId}/accept`, {
                method: 'POST',
                credentials: 'include',
            })
            if (!response.ok) {
                throw new Error('Failed to accept follower')
            }
            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pendingFollowers'] })
            queryClient.invalidateQueries({ queryKey: queryKeys.users.profile(user?.username || '') })
        },
    })

    const rejectMutation = useMutation({
        mutationFn: async (followerId: string) => {
            const response = await fetch(`/api/followers/${followerId}/reject`, {
                method: 'POST',
                credentials: 'include',
            })
            if (!response.ok) {
                throw new Error('Failed to reject follower')
            }
            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pendingFollowers'] })
        },
    })

    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar isConnected={false} user={user} onLogout={logout} />
            <div className="max-w-4xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Pending Follow Requests</h1>

                {isLoading && (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                    </div>
                )}

                {error && (
                    <div className="bg-error-50 border border-error-200 rounded-lg p-4 text-error-700">
                        {error instanceof Error ? error.message : 'Failed to load pending followers'}
                    </div>
                )}

                {data && (
                    data.followers.length === 0 ? (
                        <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
                            No pending follow requests
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {data.followers.map((follower) => (
                                    <div
                                        key={follower.followerId}
                                        className="bg-white rounded-lg shadow-sm p-6"
                                    >
                                        <div className="flex items-start gap-4">
                                            {follower.profileImage ? (
                                                <img
                                                    src={follower.profileImage}
                                                    alt={follower.name || follower.username}
                                                    className="w-16 h-16 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div
                                                    className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-semibold"
                                                    style={{ backgroundColor: follower.displayColor || colors.info[500] }}
                                                >
                                                    {(follower.name || follower.username)
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </div>
                                            )}

                                            <div className="flex-1">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <Link
                                                            to={`/@${follower.username}`}
                                                            className="text-lg font-semibold text-gray-900 hover:text-blue-600"
                                                        >
                                                            {follower.name || follower.username}
                                                        </Link>
                                                        <p className="text-sm text-gray-500">
                                                            @{follower.username}
                                                            {follower.isRemote && (
                                                                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                                                    Remote
                                                                </span>
                                                            )}
                                                        </p>
                                                        {follower.bio && (
                                                            <p className="text-sm text-gray-600 mt-2">{follower.bio}</p>
                                                        )}
                                                        <p className="text-xs text-gray-400 mt-2">
                                                            Requested {formatDate(follower.createdAt)}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex gap-3 mt-4">
                                                    <button
                                                        onClick={() => acceptMutation.mutate(follower.followerId)}
                                                        disabled={acceptMutation.isPending || rejectMutation.isPending}
                                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {acceptMutation.isPending ? 'Accepting...' : 'Accept'}
                                                    </button>
                                                    <button
                                                        onClick={() => rejectMutation.mutate(follower.followerId)}
                                                        disabled={acceptMutation.isPending || rejectMutation.isPending}
                                                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                )}
            </div>
        </div>
    )
}
