import { Avatar, Badge, Button, Card } from './ui'
import { Stack } from './layout'
import type { UserProfile } from '@/types'
import { formatDate } from '../lib/formatUtils'

interface UserProfileHeaderProps {
    user: UserProfile
    isOwnProfile: boolean
    isFollowing?: boolean
    isFollowPending?: boolean
    followerCount: number
    followingCount: number
    eventCount: number
    onFollowClick?: () => void
    onUnfollowClick?: () => void
    onFollowersClick?: () => void
    onFollowingClick?: () => void
    isFollowLoading?: boolean
    showFollowButton: boolean
    headerImageUrl?: string | null
}

/**
 * UserProfileHeader component displays user profile information including
 * avatar, name, bio, stats, and follow/unfollow actions.
 */
export function UserProfileHeader({
    user,
    isOwnProfile,
    isFollowing,
    isFollowPending,
    followerCount,
    followingCount,
    eventCount,
    onFollowClick,
    onUnfollowClick,
    onFollowersClick,
    onFollowingClick,
    isFollowLoading,
    showFollowButton,
    headerImageUrl,
}: UserProfileHeaderProps) {
    // Extract instance hostname from external actor URL
    const getInstanceHostname = () => {
        if (!user.isRemote || !user.externalActorUrl) {
return null
}
        try {
            return new URL(user.externalActorUrl).hostname
        } catch {
            return null
        }
    }

    const instanceHostname = getInstanceHostname()

    return (
        <>
            {/* Header Image */}
            {headerImageUrl && (
                <div className="w-full h-48 rounded-lg overflow-hidden mb-4">
                    <img
                        src={headerImageUrl}
                        alt="Profile header"
                        className="w-full h-full object-cover"
                    />
                </div>
            )}

            {/* Profile Info Card */}
            <Card variant="default" padding="lg" className="mb-6">
                <Stack direction="column" directionSm="row" alignSm="start" gap="md">
                    {/* Avatar */}
                    <Avatar
                        src={user.profileImage || undefined}
                        fallback={
                            (user.name || user.username).charAt(0).toUpperCase()
                        }
                        alt={user.name || user.username}
                        size="xl"
                        bordered
                        className="flex-shrink-0"
                    />

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                        <Stack direction="column" directionSm="row" alignSm="start" justifySm="between" gap="sm" className="mb-3">
                            <div className="min-w-0 flex-1">
                                <h1 className="text-2xl font-bold text-text-primary truncate">
                                    {user.name || user.username}
                                </h1>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-text-secondary text-sm">
                                        @{user.username}
                                    </p>
                                    {user.isRemote && (
                                        <>
                                            <Badge variant="info" size="sm">
                                                Remote
                                            </Badge>
                                            {instanceHostname && (
                                                <span className="text-text-tertiary text-xs">
                                                    from {instanceHostname}
                                                </span>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Follow Button */}
                            {!isOwnProfile && showFollowButton && (
                                <div className="flex-shrink-0">
                                    {isFollowing ? (
                                        <Button
                                            variant="secondary"
                                            size="md"
                                            onClick={onUnfollowClick}
                                            loading={isFollowLoading}
                                            disabled={isFollowLoading}
                                        >
                                            Unfollow
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="primary"
                                            size="md"
                                            onClick={onFollowClick}
                                            loading={isFollowLoading}
                                            disabled={isFollowLoading || isFollowPending}
                                        >
                                            {isFollowPending ? 'Pending' : 'Follow'}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </Stack>

                        {/* Bio */}
                        {user.bio && (
                            <p className="text-text-primary mb-4 whitespace-pre-wrap">
                                {user.bio}
                            </p>
                        )}

                        {/* Stats */}
                        <div className="flex flex-wrap gap-4 sm:gap-6 text-sm">
                            <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-text-primary">
                                    {eventCount}
                                </span>
                                <span className="text-text-secondary">
                                    {eventCount === 1 ? 'Event' : 'Events'}
                                </span>
                            </div>
                            <Button
                                onClick={onFollowersClick}
                                variant="ghost"
                                size="sm"
                                className="flex items-center gap-1.5 hover:text-text-primary transition-colors h-auto p-0"
                            >
                                <span className="font-semibold text-text-primary">
                                    {followerCount}
                                </span>
                                <span className="text-text-secondary">
                                    {followerCount === 1 ? 'Follower' : 'Followers'}
                                </span>
                            </Button>
                            <Button
                                onClick={onFollowingClick}
                                variant="ghost"
                                size="sm"
                                className="flex items-center gap-1.5 hover:text-text-primary transition-colors h-auto p-0"
                            >
                                <span className="font-semibold text-text-primary">
                                    {followingCount}
                                </span>
                                <span className="text-text-secondary">Following</span>
                            </Button>
                        </div>

                        {/* Join Date */}
                        {user.createdAt && (
                            <p className="text-xs text-text-tertiary mt-3">
                                Joined {formatDate(user.createdAt)}
                            </p>
                        )}
                    </div>
                </Stack>
            </Card>
        </>
    )
}
