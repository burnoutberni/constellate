import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { FollowersModal } from '../components/FollowersModal'
import { UserProfileHeader } from '../components/UserProfileHeader'
import { UserEventList } from '../components/UserEventList'
import { SignUpPrompt } from '../components/SignUpPrompt'
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

    const isOwnProfile = currentUser?.id === profileData?.user.id
    const isAuthenticated = !!currentUser

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
                    <div className="bg-error-50 border border-error-200 rounded-lg p-4 text-error-700">
                        {error instanceof Error ? error.message : 'Failed to load profile'}
                    </div>
                )}

                {profileData && (
                    <>
                        {/* Profile Header */}
                        <UserProfileHeader
                            user={profileData.user}
                            isOwnProfile={isOwnProfile}
                            isFollowing={followStatus?.isFollowing}
                            isFollowPending={followStatus?.isFollowing && !followStatus?.isAccepted}
                            followerCount={profileData.user._count?.followers || 0}
                            followingCount={profileData.user._count?.following || 0}
                            eventCount={profileData.user._count?.events || 0}
                            onFollowClick={handleFollow}
                            onUnfollowClick={handleUnfollow}
                            onFollowersClick={() => openFollowersModal(profileData.user.username, 'followers')}
                            onFollowingClick={() => openFollowersModal(profileData.user.username, 'following')}
                            isFollowLoading={followMutation.isPending || unfollowMutation.isPending}
                            showFollowButton={isAuthenticated}
                            headerImageUrl={profileData.user.headerImage}
                        />

                        {/* Sign Up Prompt for Unauthenticated Users */}
                        {!isAuthenticated && !isOwnProfile && (
                            <SignUpPrompt
                                action="follow"
                                className="mb-6"
                            />
                        )}

                        {/* Events Section */}
                        <div>
                            <h2 className="text-xl font-bold text-text-primary mb-4">
                                Events ({profileData.events.length})
                            </h2>

                            <UserEventList
                                events={profileData.events}
                                onEventClick={(eventId) => navigate(`/@${profileData.user.username}/${eventId}`)}
                            />
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
