import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { FollowersModal } from '../components/FollowersModal'
import { useAuth } from '../contexts/AuthContext'
import { useUserProfile, useFollowStatus, useFollowUser, useUnfollowUser } from '../hooks/queries/users'
import { useUIStore } from '../stores/uiStore'

export function UserProfilePage() {
    const location = useLocation()
    const navigate = useNavigate()
    const { user: currentUser, logout } = useAuth()
    const [username, setUsername] = useState<string>('')

    useEffect(() => {
        // Check if this is a profile route (starts with /@)
        if (!location.pathname.startsWith('/@')) {
            return
        }

        // Extract path parts
        const pathParts = location.pathname.split('/').filter(Boolean)

        // If there are more than 1 parts after @, it's an event route, not a profile
        // Example: /@alice/eventId has 2 parts, /@alice has 1 part
        if (pathParts.length > 1) {
            return // This is an event route, not a profile route
        }

        // Extract handle from pathname (e.g., /@alice or /@alice@app1.local)
        // Remove /@ prefix (2 characters)
        const handle = location.pathname.slice(2)

        if (handle) {
            setUsername(handle)
        }
    }, [location.pathname])

    const { data: profileData, isLoading, error } = useUserProfile(username)
    const { data: followStatus } = useFollowStatus(username)
    const followMutation = useFollowUser(username)
    const unfollowMutation = useUnfollowUser(username)
    const { followersModalOpen, followersModalUsername, followersModalType, openFollowersModal, closeFollowersModal } = useUIStore()

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })
    }

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
        })
    }

    const handleFollow = async () => {
        if (!currentUser || !profileData) return
        try {
            await followMutation.mutateAsync()
        } catch (err) {
            console.error('Error following user:', err)
            alert('Failed to follow user')
        }
    }

    const handleUnfollow = async () => {
        if (!currentUser || !profileData) return
        try {
            await unfollowMutation.mutateAsync()
        } catch (err) {
            console.error('Error unfollowing user:', err)
            alert('Failed to unfollow user')
        }
    }

    const renderFollowButton = () => {
        const isCurrentlyFollowing = Boolean(followStatus?.isFollowing)
        const isAcceptedFollow = Boolean(followStatus?.isAccepted)
        const isPendingFollow = isCurrentlyFollowing && !isAcceptedFollow

        if (isPendingFollow && !followMutation.isPending) {
            return (
                <button
                    type="button"
                    disabled
                    className="px-4 py-2 bg-yellow-500 text-white rounded-lg font-medium flex items-center gap-2 cursor-not-allowed"
                >
                    <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Pending approval...</span>
                </button>
            )
        }

        if (isCurrentlyFollowing) {
            return (
                <button
                    onClick={handleUnfollow}
                    disabled={unfollowMutation.isPending}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {unfollowMutation.isPending ? (
                        <>
                            <svg className="animate-spin h-4 w-4 text-gray-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Unfollowing...</span>
                        </>
                    ) : (
                        'Unfollow'
                    )}
                </button>
            )
        }

        const getFollowButtonContent = () => {
            if (followMutation.isPending) {
                return (
                    <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Following...</span>
                    </>
                )
            }

            return 'Follow'
        }

        return (
            <button
                onClick={handleFollow}
                disabled={followMutation.isPending || followMutation.isSuccess}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {getFollowButtonContent()}
            </button>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar
                isConnected={false}
                user={currentUser}
                onLogout={logout}
            />

            <div className="max-w-4xl mx-auto px-4 py-8">
                {isLoading && (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                        {error instanceof Error ? error.message : 'Failed to load profile'}
                    </div>
                )}

                {profileData && (
                    <>
                        {/* Header Image */}
                        {profileData.user.headerImage && (
                            <div className="w-full h-48 rounded-lg overflow-hidden mb-4">
                                <img
                                    src={profileData.user.headerImage}
                                    alt="Header"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        )}

                        {/* Profile Info */}
                        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                            <div className="flex items-start gap-4">
                                {profileData.user.profileImage ? (
                                    <img
                                        src={profileData.user.profileImage}
                                        alt={profileData.user.name || profileData.user.username}
                                        className="w-24 h-24 rounded-full object-cover"
                                    />
                                ) : (
                                    <div
                                        className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-semibold"
                                        style={{ backgroundColor: profileData.user.displayColor }}
                                    >
                                        {(profileData.user.name || profileData.user.username)
                                            .charAt(0)
                                            .toUpperCase()}
                                    </div>
                                )}

                                <div className="flex-1">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h1 className="text-2xl font-bold text-gray-900">
                                                {profileData.user.name || profileData.user.username}
                                            </h1>
                                            <p className="text-gray-500 mb-2">
                                                @{profileData.user.username}
                                                {profileData.user.isRemote && (
                                                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                                        Remote
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        {currentUser && currentUser.id !== profileData.user.id && (
                                            <div className="ml-4">
                                                {renderFollowButton()}
                                            </div>
                                        )}
                                    </div>

                                    {profileData.user.bio && (
                                        <p className="text-gray-700 mb-4">{profileData.user.bio}</p>
                                    )}

                                    <div className="flex gap-6 text-sm text-gray-600">
                                        <div>
                                            <span className="font-semibold text-gray-900">
                                                {profileData.user._count?.events || 0}
                                            </span>{' '}
                                            Events
                                        </div>
                                        <button
                                            onClick={() => openFollowersModal(profileData.user.username, 'followers')}
                                            className="hover:text-gray-900 transition-colors cursor-pointer"
                                        >
                                            <span className="font-semibold text-gray-900">
                                                {profileData.user._count?.followers || 0}
                                            </span>{' '}
                                            Followers
                                        </button>
                                        <button
                                            onClick={() => openFollowersModal(profileData.user.username, 'following')}
                                            className="hover:text-gray-900 transition-colors cursor-pointer"
                                        >
                                            <span className="font-semibold text-gray-900">
                                                {profileData.user._count?.following || 0}
                                            </span>{' '}
                                            Following
                                        </button>
                                    </div>

                                    {profileData.user.createdAt && (
                                        <p className="text-xs text-gray-400 mt-2">
                                            Joined {formatDate(profileData.user.createdAt)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Events */}
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 mb-4">
                                Events ({profileData.events.length})
                            </h2>

                            {profileData.events.length === 0 ? (
                                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
                                    No events yet
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {profileData.events.map((event) => (
                                        <div
                                            key={event.id}
                                            onClick={() => navigate(`/@${profileData.user.username}/${event.id}`)}
                                            className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer"
                                        >
                                            {event.headerImage && (
                                                <img
                                                    src={event.headerImage}
                                                    alt={event.title}
                                                    className="w-full h-48 object-cover rounded-lg mb-4"
                                                />
                                            )}

                                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                                {event.title}
                                            </h3>

                                            {event.summary && (
                                                <p className="text-gray-600 mb-3 line-clamp-2">
                                                    {event.summary}
                                                </p>
                                            )}

                                            <div className="flex items-center gap-4 text-sm text-gray-500">
                                                <div className="flex items-center gap-1">
                                                    <svg
                                                        className="w-4 h-4"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                                        />
                                                    </svg>
                                                    {formatDate(event.startTime)} at {formatTime(event.startTime)}
                                                </div>

                                                {event.location && (
                                                    <div className="flex items-center gap-1">
                                                        <svg
                                                            className="w-4 h-4"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                                            />
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                                            />
                                                        </svg>
                                                        {event.location}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                                                <span>{event._count?.attendance || 0} attending</span>
                                                <span>{event._count?.likes || 0} likes</span>
                                                <span>{event._count?.comments || 0} comments</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Followers/Following Modal */}
            {followersModalOpen && followersModalUsername && followersModalType && (
                <FollowersModal
                    isOpen={followersModalOpen}
                    onClose={closeFollowersModal}
                    username={followersModalUsername}
                    type={followersModalType}
                />
            )}
        </div>
    )
}
