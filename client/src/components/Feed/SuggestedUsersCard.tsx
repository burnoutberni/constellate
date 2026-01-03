
import { Link } from 'react-router-dom'

import { FollowButton } from '@/components/FollowButton'
import { Avatar, Card } from '@/components/ui'
import type { SuggestedUser } from '@/types'

interface SuggestedUsersCardProps {
    users: SuggestedUser[]
}

export function SuggestedUsersCard({ users }: SuggestedUsersCardProps) {
    if (users.length === 0) { return null }

    return (
        <Card variant="default" padding="md" className="mb-4">
            <h3 className="font-semibold text-text-primary mb-3">Who to follow</h3>
            <div className="space-y-3">
                {users.map(user => (
                    <div key={user.id} className="flex items-center gap-3 justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                            <Link to={`/@${user.username}`}>
                                <Avatar
                                    src={user.profileImage || undefined}
                                    fallback={(user.name?.[0] || user.username[0]).toUpperCase()}
                                    size="md"
                                />
                            </Link>
                            <div className="min-w-0">
                                <Link to={`/@${user.username}`} className="block truncate font-medium text-text-primary hover:underline">
                                    {user.name || `@${user.username}`}
                                </Link>
                                <div className="text-xs text-text-secondary truncate">
                                    @{user.username}
                                    {user._count && ` · ${user._count.followers} followers`}
                                </div>
                            </div>
                        </div>
                        <FollowButton username={user.username} size="sm" variant="secondary" />
                    </div>
                ))}
            </div>
        </Card>
    )
}
