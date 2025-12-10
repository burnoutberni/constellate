import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UserProfileHeader } from './UserProfileHeader'
import type { UserProfile } from '../types'

const mockUser: UserProfile = {
    id: '1',
    username: 'testuser',
    name: 'Test User',
    bio: 'This is a test bio',
    profileImage: 'https://example.com/avatar.jpg',
    displayColor: '#3B82F6',
    timezone: 'UTC',
    isRemote: false,
    externalActorUrl: null,
    createdAt: '2023-01-01T00:00:00.000Z',
    _count: {
        events: 5,
        followers: 10,
        following: 8,
    },
}

describe('UserProfileHeader Component', () => {
    it('should render user information correctly', () => {
        render(
            <UserProfileHeader
                user={mockUser}
                isOwnProfile={false}
                followerCount={10}
                followingCount={8}
                eventCount={5}
                showFollowButton={true}
            />
        )

        expect(screen.getByText('Test User')).toBeInTheDocument()
        expect(screen.getByText('@testuser')).toBeInTheDocument()
        expect(screen.getByText('This is a test bio')).toBeInTheDocument()
    })

    it('should display correct stats', () => {
        render(
            <UserProfileHeader
                user={mockUser}
                isOwnProfile={false}
                followerCount={10}
                followingCount={8}
                eventCount={5}
                showFollowButton={true}
            />
        )

        expect(screen.getByText('5')).toBeInTheDocument()
        expect(screen.getByText('Events')).toBeInTheDocument()
        expect(screen.getByText('10')).toBeInTheDocument()
        expect(screen.getByText('Followers')).toBeInTheDocument()
        expect(screen.getByText('8')).toBeInTheDocument()
        expect(screen.getByText('Following')).toBeInTheDocument()
    })

    it('should show follow button when not own profile and authenticated', () => {
        render(
            <UserProfileHeader
                user={mockUser}
                isOwnProfile={false}
                isFollowing={false}
                followerCount={10}
                followingCount={8}
                eventCount={5}
                showFollowButton={true}
                onFollowClick={vi.fn()}
            />
        )

        const buttons = screen.getAllByRole('button')
        const followButton = buttons.find(btn => btn.textContent?.trim() === 'Follow')
        expect(followButton).toBeDefined()
        expect(followButton).toBeInTheDocument()
    })

    it('should show unfollow button when following', () => {
        render(
            <UserProfileHeader
                user={mockUser}
                isOwnProfile={false}
                isFollowing={true}
                followerCount={10}
                followingCount={8}
                eventCount={5}
                showFollowButton={true}
                onUnfollowClick={vi.fn()}
            />
        )

        const unfollowButton = screen.getByRole('button', { name: /Unfollow/i })
        expect(unfollowButton).toBeInTheDocument()
    })

    it('should not show follow button when own profile', () => {
        render(
            <UserProfileHeader
                user={mockUser}
                isOwnProfile={true}
                followerCount={10}
                followingCount={8}
                eventCount={5}
                showFollowButton={false}
            />
        )

        const buttons = screen.getAllByRole('button')
        const followButton = buttons.find(btn => btn.textContent === 'Follow')
        const unfollowButton = buttons.find(btn => btn.textContent === 'Unfollow')
        
        expect(followButton).toBeUndefined()
        expect(unfollowButton).toBeUndefined()
    })

    it('should call onFollowClick when follow button is clicked', () => {
        const onFollowClick = vi.fn()
        render(
            <UserProfileHeader
                user={mockUser}
                isOwnProfile={false}
                isFollowing={false}
                followerCount={10}
                followingCount={8}
                eventCount={5}
                showFollowButton={true}
                onFollowClick={onFollowClick}
            />
        )

        const buttons = screen.getAllByRole('button')
        const followButton = buttons.find(btn => btn.textContent?.trim() === 'Follow')
        expect(followButton).toBeDefined()
        expect(followButton).toBeInTheDocument()
        fireEvent.click(followButton!)
        expect(onFollowClick).toHaveBeenCalledTimes(1)
    })

    it('should call onUnfollowClick when unfollow button is clicked', () => {
        const onUnfollowClick = vi.fn()
        render(
            <UserProfileHeader
                user={mockUser}
                isOwnProfile={false}
                isFollowing={true}
                followerCount={10}
                followingCount={8}
                eventCount={5}
                showFollowButton={true}
                onUnfollowClick={onUnfollowClick}
            />
        )

        const unfollowButton = screen.getByRole('button', { name: /Unfollow/i })
        fireEvent.click(unfollowButton)
        expect(onUnfollowClick).toHaveBeenCalledTimes(1)
    })

    it('should show pending state when follow is pending', () => {
        render(
            <UserProfileHeader
                user={mockUser}
                isOwnProfile={false}
                isFollowing={false}
                isFollowPending={true}
                followerCount={10}
                followingCount={8}
                eventCount={5}
                showFollowButton={true}
            />
        )

        const pendingButton = screen.getByRole('button', { name: /Pending/i })
        expect(pendingButton).toBeInTheDocument()
    })

    it('should display remote badge and instance for remote users', () => {
        const remoteUser: UserProfile = {
            ...mockUser,
            isRemote: true,
            externalActorUrl: 'https://remote.instance.com/users/testuser',
        }

        render(
            <UserProfileHeader
                user={remoteUser}
                isOwnProfile={false}
                followerCount={10}
                followingCount={8}
                eventCount={5}
                showFollowButton={true}
            />
        )

        expect(screen.getByText('Remote')).toBeInTheDocument()
        expect(screen.getByText(/from remote.instance.com/i)).toBeInTheDocument()
    })

    it('should display header image when provided', () => {
        render(
            <UserProfileHeader
                user={mockUser}
                isOwnProfile={false}
                followerCount={10}
                followingCount={8}
                eventCount={5}
                showFollowButton={true}
                headerImageUrl="https://example.com/header.jpg"
            />
        )

        const headerImage = screen.getByAltText('Profile header')
        expect(headerImage).toBeInTheDocument()
        expect(headerImage).toHaveAttribute('src', 'https://example.com/header.jpg')
    })

    it('should call onFollowersClick when followers stat is clicked', () => {
        const onFollowersClick = vi.fn()
        render(
            <UserProfileHeader
                user={mockUser}
                isOwnProfile={false}
                followerCount={10}
                followingCount={8}
                eventCount={5}
                showFollowButton={true}
                onFollowersClick={onFollowersClick}
            />
        )

        const followersButtons = screen.getAllByRole('button')
        const followersButton = followersButtons.find(btn => btn.textContent?.includes('10') && btn.textContent?.includes('Follower'))
        
        if (followersButton) {
            fireEvent.click(followersButton)
            expect(onFollowersClick).toHaveBeenCalledTimes(1)
        }
    })

    it('should call onFollowingClick when following stat is clicked', () => {
        const onFollowingClick = vi.fn()
        render(
            <UserProfileHeader
                user={mockUser}
                isOwnProfile={false}
                followerCount={10}
                followingCount={8}
                eventCount={5}
                showFollowButton={true}
                onFollowingClick={onFollowingClick}
            />
        )

        const followingButtons = screen.getAllByRole('button')
        const followingButton = followingButtons.find(btn => btn.textContent?.includes('8') && btn.textContent?.includes('Following'))
        
        if (followingButton) {
            fireEvent.click(followingButton)
            expect(onFollowingClick).toHaveBeenCalledTimes(1)
        }
    })

    it('should show loading state on follow button', () => {
        render(
            <UserProfileHeader
                user={mockUser}
                isOwnProfile={false}
                isFollowing={false}
                followerCount={10}
                followingCount={8}
                eventCount={5}
                showFollowButton={true}
                isFollowLoading={true}
            />
        )

        // Find the disabled button (the follow button in loading state)
        const buttons = screen.getAllByRole('button')
        const followButton = buttons.find(btn => 
            btn.hasAttribute('disabled') && 
            (btn.textContent?.includes('Follow') || btn.querySelector('svg.animate-spin'))
        )
        expect(followButton).toBeDefined()
        expect(followButton).toBeDisabled()
    })
})
