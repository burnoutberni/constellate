import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { Container } from '@/components/layout'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Card, CardContent, CardHeader, CardTitle, Spinner, Button } from '@/components/ui'
import { queryKeys } from '@/hooks/queries'
import { api } from '@/lib/api-client'
import type { UserProfile } from '@/types'

import { AccountSettings } from '../components/AccountSettings'
import { DataExportSettings } from '../components/DataExportSettings'
import { Navbar } from '../components/Navbar'
import { PrivacySettings } from '../components/PrivacySettings'
import { ProfileSettings } from '../components/ProfileSettings'
import { TimeZoneSettings } from '../components/TimeZoneSettings'
import { useAuth } from '../hooks/useAuth'
import { setSEOMetadata } from '../lib/seo'

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
			<div className="min-h-screen bg-background-secondary">
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
			<div className="min-h-screen bg-background-secondary">
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
		<div className="min-h-screen bg-background-secondary">
			<Navbar isConnected={false} user={user} onLogout={logout} />
			<Container className="py-8" size="md">
				<h1 className="text-3xl font-bold text-text-primary mb-8">Settings</h1>

				<div className="space-y-6">
					{/* Appearance Settings */}
					<Card>
						<CardHeader>
							<CardTitle>Appearance</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium text-text-primary">Theme</p>
									<p className="text-sm text-text-secondary">
										Customize how Constellate looks on your device.
									</p>
								</div>
								<ThemeToggle />
							</div>
						</CardContent>
					</Card>

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
							isPublicProfile: profile.isPublicProfile ?? true,
						}}
						userId={user?.id}
					/>

					{/* Moderation & Appeals */}
					<Card>
						<CardHeader>
							<CardTitle>Moderation & Appeals</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium text-text-primary">My Reports</p>
									<p className="text-sm text-text-secondary">
										View the status of your content reports.
									</p>
								</div>
								<Link to="/reports">
									<Button variant="outline">View Reports</Button>
								</Link>
							</div>
							<div className="flex items-center justify-between pt-4 border-t border-border-default">
								<div>
									<p className="font-medium text-text-primary">My Appeals</p>
									<p className="text-sm text-text-secondary">
										View the status of your moderation appeals.
									</p>
								</div>
								<Link to="/appeals">
									<Button variant="outline">View Appeals</Button>
								</Link>
							</div>
						</CardContent>
					</Card>

					{/* Data Export */}
					<DataExportSettings />

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
