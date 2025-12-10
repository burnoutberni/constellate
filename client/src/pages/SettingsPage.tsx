import { Navbar } from '../components/Navbar'
import { useAuth } from '../contexts/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../hooks/queries/keys'
import { Container } from '../components/layout/Container'
import { ProfileSettings } from '../components/ProfileSettings'
import { PrivacySettings } from '../components/PrivacySettings'
import { TimeZoneSettings } from '../components/TimeZoneSettings'
import { AccountSettings } from '../components/AccountSettings'
import { setSEOMetadata } from '../lib/seo'
import { useEffect } from 'react'

export function SettingsPage() {
    const { user, logout } = useAuth()

    const { data: profile, isLoading } = useQuery({
        queryKey: queryKeys.users.currentProfile(user?.id),
        queryFn: async () => {
            if (!user?.id) {
                return null
            }
            const response = await fetch(`/api/users/me/profile`, {
                credentials: 'include',
            })
            if (!response.ok) {
                throw new Error('Failed to fetch profile')
            }
            return response.json()
        },
        enabled: !!user?.id,
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
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
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
                        <p className="text-text-secondary">Failed to load profile. Please try again.</p>
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
                    <ProfileSettings profile={profile} userId={user?.id} />

                    {/* Time Zone Settings */}
                    <TimeZoneSettings profile={profile} userId={user?.id} />

                    {/* Privacy Settings */}
                    <PrivacySettings profile={profile} userId={user?.id} />

                    {/* Account Settings */}
                    <AccountSettings profile={profile} />
                </div>
            </Container>
        </div>
    )
}

