import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../contexts/AuthContext'

interface User {
    id: string
    username: string
    name: string | null
    bio: string | null
    profileImage: string | null
    headerImage: string | null
    displayColor: string
    isRemote: boolean
    externalActorUrl: string | null
    createdAt: string
    _count: {
        followers: number
        following: number
        events: number
    }
}

interface Event {
    id: string
    title: string
    summary: string | null
    startTime: string
    endTime: string | null
    location: string | null
    headerImage: string | null
    user: {
        id: string
        username: string
        name: string | null
        displayColor: string
        profileImage: string | null
    } | null
    _count: {
        attendance: number
        likes: number
        comments: number
    }
}

interface ProfileData {
    user: User
    events: Event[]
}

interface FollowStatus {
    isFollowing: boolean
    isAccepted: boolean
}

export function UserProfilePage() {
    const location = useLocation()
    const navigate = useNavigate()
    const { user: currentUser, logout } = useAuth()
    const [profileData, setProfileData] = useState<ProfileData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [followStatus, setFollowStatus] = useState<FollowStatus | null>(null)
    const [isFollowingAction, setIsFollowingAction] = useState(false)

    useEffect(() => {
        const fetchProfile = async () => {
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

            if (!handle) return

            setIsLoading(true)
            setError(null)

            try {
                const response = await fetch(`/api/user-search/profile/${encodeURIComponent(handle)}`)

                if (!response.ok) {
                    if (response.status === 404) {
                        setError('User not found')
                    } else {
                        setError('Failed to load profile')
                    }
                    return
                }

                const data = await response.json()
                setProfileData(data)

                // Fetch follow status if user is logged in
                if (currentUser) {
                    try {
                        const followResponse = await fetch(
                            `/api/users/${encodeURIComponent(handle)}/follow-status`,
                            {
                                credentials: 'include',
                            }
                        )
                        if (followResponse.ok) {
                            const followData = await followResponse.json()
                            setFollowStatus(followData)
                        }
                    } catch (err) {
                        console.error('Error fetching follow status:', err)
                    }
                }
            } catch (err) {
                console.error('Error fetching profile:', err)
                setError('Failed to load profile')
            } finally {
                setIsLoading(false)
            }
        }

        fetchProfile()
    }, [location.pathname, currentUser])

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

        // Save previous state for rollback
        const previousFollowStatus = followStatus
        const previousFollowerCount = profileData.user._count.followers

        setIsFollowingAction(true)
        
        // Optimistically update UI
        setFollowStatus({ isFollowing: true, isAccepted: false })
        setProfileData({
            ...profileData,
            user: {
                ...profileData.user,
                _count: {
                    ...profileData.user._count,
                    followers: previousFollowerCount + 1,
                },
            },
        })

        try {
            const handle = location.pathname.slice(2)
            const response = await fetch(`/api/users/${encodeURIComponent(handle)}/follow`, {
                method: 'POST',
                credentials: 'include',
            })

            if (!response.ok) {
                // Revert to previous state on failure
                setFollowStatus(previousFollowStatus)
                setProfileData({
                    ...profileData,
                    user: {
                        ...profileData.user,
                        _count: {
                            ...profileData.user._count,
                            followers: previousFollowerCount,
                        },
                    },
                })
                const error = await response.json()
                alert(error.error || 'Failed to follow user')
                return
            }

            // Success - state already updated optimistically
        } catch (err) {
            // Revert to previous state on error
            setFollowStatus(previousFollowStatus)
            setProfileData({
                ...profileData,
                user: {
                    ...profileData.user,
                    _count: {
                        ...profileData.user._count,
                        followers: previousFollowerCount,
                    },
                },
            })
            console.error('Error following user:', err)
            alert('Failed to follow user')
        } finally {
            setIsFollowingAction(false)
        }
    }

    const handleUnfollow = async () => {
        if (!currentUser || !profileData) return

        // Save previous state for rollback
        const previousFollowStatus = followStatus
        const previousFollowerCount = profileData.user._count.followers

        setIsFollowingAction(true)
        
        // Optimistically update UI
        setFollowStatus({ isFollowing: false, isAccepted: false })
        setProfileData({
            ...profileData,
            user: {
                ...profileData.user,
                _count: {
                    ...profileData.user._count,
                    followers: Math.max(0, previousFollowerCount - 1),
                },
            },
        })

        try {
            const handle = location.pathname.slice(2)
            const response = await fetch(`/api/users/${encodeURIComponent(handle)}/follow`, {
                method: 'DELETE',
                credentials: 'include',
            })

            if (!response.ok) {
                // Revert to previous state on failure
                setFollowStatus(previousFollowStatus)
                setProfileData({
                    ...profileData,
                    user: {
                        ...profileData.user,
                        _count: {
                            ...profileData.user._count,
                            followers: previousFollowerCount,
                        },
                    },
                })
                const error = await response.json()
                alert(error.error || 'Failed to unfollow user')
                return
            }

            // Success - state already updated optimistically
        } catch (err) {
            // Revert to previous state on error
            setFollowStatus(previousFollowStatus)
            setProfileData({
                ...profileData,
                user: {
                    ...profileData.user,
                    _count: {
                        ...profileData.user._count,
                        followers: previousFollowerCount,
                    },
                },
            })
            console.error('Error unfollowing user:', err)
            alert('Failed to unfollow user')
        } finally {
            setIsFollowingAction(false)
        }
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
                        {error}
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
                                                {followStatus?.isFollowing ? (
                                                    <button
                                                        onClick={handleUnfollow}
                                                        disabled={isFollowingAction}
                                                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {isFollowingAction ? 'Unfollowing...' : 'Unfollow'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={handleFollow}
                                                        disabled={isFollowingAction}
                                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {isFollowingAction ? 'Following...' : 'Follow'}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {profileData.user.bio && (
                                        <p className="text-gray-700 mb-4">{profileData.user.bio}</p>
                                    )}

                                    <div className="flex gap-6 text-sm text-gray-600">
                                        <div>
                                            <span className="font-semibold text-gray-900">
                                                {profileData.user._count.events}
                                            </span>{' '}
                                            Events
                                        </div>
                                        <div>
                                            <span className="font-semibold text-gray-900">
                                                {profileData.user._count.followers}
                                            </span>{' '}
                                            Followers
                                        </div>
                                        <div>
                                            <span className="font-semibold text-gray-900">
                                                {profileData.user._count.following}
                                            </span>{' '}
                                            Following
                                        </div>
                                    </div>

                                    <p className="text-xs text-gray-400 mt-2">
                                        Joined {formatDate(profileData.user.createdAt)}
                                    </p>
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
                                                <span>{event._count.attendance} attending</span>
                                                <span>{event._count.likes} likes</span>
                                                <span>{event._count.comments} comments</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
