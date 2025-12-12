import { Navbar } from '../components/Navbar'
import { useAuth } from '../hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/hooks/queries'
import { Container } from '@/components/layout'
import { Spinner } from '@/components/ui'
import { ProfileSettings } from '../components/ProfileSettings'
import { PrivacySettings } from '../components/PrivacySettings'
import { TimeZoneSettings } from '../components/TimeZoneSettings'
import { AccountSettings } from '../components/AccountSettings'
import { setSEOMetadata } from '../lib/seo'
import { useEffect } from 'react'
import { api } from '@/lib/api-client'
import type { UserProfile } from '@/types'

export function SettingsPage() {
	const { user, logout } = useAuth()

	const { data: profile, isLoading } = useQuery<UserProfile | null>({
		queryKey: queryKeys.users.currentProfile(user?.id),
		queryFn: async () => {
			if (!user?.id) {
				return null
			}
			return api.get<UserProfile>(
				'/users/me/profile',
				undefined,
				undefined,
				'Failed to fetch profile'
			)
		},
		enabled: Boolean(user?.id),
	})

	// Set SEO metadata
	useEffect(() => {
		setSEOMetadata({
			title: 'Settings',
			description: 'Manage your account settings and preferences',
		})
	}, [])

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background-primary">
				<Navbar isConnected={false} user={user} onLogout={logout} />
				<Container className="py-8">
					<div className="flex justify-center items-center py-12">
						<Spinner size="lg" />
					</div>
				</Container>
			</div>
		)
	}

	if (!profile) {
		return (
			<div className="min-h-screen bg-background-primary">
				<Navbar isConnected={false} user={user} onLogout={logout} />
				<Container className="py-8">
					<div className="text-center py-12">
						<p className="text-text-secondary">
							Failed to load profile. Please try again.
						</p>
					</div>
				</Container>
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-background-primary">
			<Navbar isConnected={false} user={user} onLogout={logout} />
			<Container className="py-8">
				<h1 className="text-3xl font-bold text-text-primary mb-8">Settings</h1>

				<div className="space-y-6">
					{/* Profile Settings */}
					<ProfileSettings
						profile={{
							id: profile.id,
							username: profile.username,
							name: profile.name ?? null,
							bio: profile.bio ?? null,
							profileImage: profile.profileImage ?? null,
							headerImage: profile.headerImage ?? null,
							displayColor: profile.displayColor,
						}}
						userId={user?.id}
					/>

					{/* Time Zone Settings */}
					<TimeZoneSettings profile={profile} userId={user?.id} />

					{/* Privacy Settings */}
					<PrivacySettings
						profile={{
							autoAcceptFollowers: profile.autoAcceptFollowers ?? true,
						}}
						userId={user?.id}
					/>

					{/* Account Settings */}
					<AccountSettings
						profile={{
							email: profile.email ?? null,
							username: profile.username,
						}}
					/>
				</div>
			</Container>
		</div>
	)
}
