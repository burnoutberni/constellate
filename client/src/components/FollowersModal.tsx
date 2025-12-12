import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { User } from '@/types'
import { useThemeColors } from '@/design-system'
import { queryKeys } from '@/hooks/queries'
import { Modal, Button, Spinner } from './ui'
import { api } from '@/lib/api-client'

interface FollowersModalProps {
    isOpen: boolean
    onClose: () => void
    username: string
    type: 'followers' | 'following'
}

export function FollowersModal({ isOpen, onClose, username, type }: FollowersModalProps) {
    const colors = useThemeColors()
    const { data, isLoading } = useQuery<{ followers?: User[]; following?: User[] }>({
        queryKey: type === 'followers' ? queryKeys.users.followers(username) : queryKeys.users.following(username),
        queryFn: async () => {
            return api.get<{ followers?: User[]; following?: User[] }>(
                `/user-search/profile/${encodeURIComponent(username)}/${type}`,
                undefined,
                undefined,
                'Failed to fetch'
            )
        },
        enabled: isOpen && Boolean(username),
    })

    const users = type === 'followers' ? data?.followers : data?.following

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="md">
            <div className="card w-full p-6 bg-white shadow-2xl rounded-xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-neutral-900">
                        {type === 'followers' ? 'Followers' : 'Following'}
                    </h2>
                    <Button
                        onClick={onClose}
                        variant="ghost"
                        size="sm"
                        className="text-neutral-500 hover:text-neutral-700 text-2xl h-auto p-0 min-w-0"
                    >
                        ×
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Spinner size="md" />
                        </div>
                    ) : (() => {
                        if (!users || users.length === 0) {
                            return (
                                <div className="text-center py-8 text-neutral-500">
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
                                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors"
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
                                            <div className="font-semibold text-neutral-900">
                                                {user.name || user.username}
                                            </div>
                                            <div className="text-sm text-neutral-500">
                                                @{user.username}
                                                {user.isRemote && (
                                                    <span className="ml-2 text-xs text-info-600">Remote</span>
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
        </Modal>
    )
}
