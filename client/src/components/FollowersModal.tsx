import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { User } from '@/types'
import { useThemeColors } from '@/design-system'

interface FollowersModalProps {
    isOpen: boolean
    onClose: () => void
    username: string
    type: 'followers' | 'following'
}

export function FollowersModal({ isOpen, onClose, username, type }: FollowersModalProps) {
    const colors = useThemeColors()
    const { data, isLoading } = useQuery<{ followers?: User[]; following?: User[] }>({
        queryKey: ['user', type, username],
        queryFn: async () => {
            const response = await fetch(
                `/api/user-search/profile/${encodeURIComponent(username)}/${type}`,
                {
                    credentials: 'include',
                },
            )
            if (!response.ok) {
                throw new Error('Failed to fetch')
            }
            return response.json()
        },
        enabled: isOpen && Boolean(username),
    })

    const users = type === 'followers' ? data?.followers : data?.following

    if (!isOpen) {
return null
}

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="card w-full max-w-md p-6 bg-white shadow-2xl rounded-xl animate-slide-up max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">
                        {type === 'followers' ? 'Followers' : 'Following'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
                        </div>
                    ) : (() => {
                        if (!users || users.length === 0) {
                            return (
                                <div className="text-center py-8 text-gray-500">
                                    {type === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                                </div>
                            )
                        }
                        return (
                            <div className="space-y-2">
                                {users.map((user) => (
                                    <Link
                                        key={user.id}
                                        to={`/@${user.username}`}
                                        onClick={onClose}
                                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        {user.profileImage ? (
                                            <img
                                                src={user.profileImage}
                                                alt={user.name || user.username}
                                                className="w-12 h-12 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div
                                                className="avatar w-12 h-12"
                                                style={{ backgroundColor: user.displayColor || colors.info[500] }}
                                            >
                                                {(user.name || user.username)[0].toUpperCase()}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-gray-900">
                                                {user.name || user.username}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                @{user.username}
                                                {user.isRemote && (
                                                    <span className="ml-2 text-xs text-blue-600">Remote</span>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )
                    })()}
                </div>
            </div>
        </div>
    )
}
