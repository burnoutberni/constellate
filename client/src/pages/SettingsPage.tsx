import { useState } from 'react'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../contexts/AuthContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../hooks/queries/keys'

export function SettingsPage() {
    const { user, logout } = useAuth()
    const queryClient = useQueryClient()

    const { data: profile, isLoading } = useQuery({
        queryKey: queryKeys.users.profile(user?.username || ''),
        queryFn: async () => {
            const response = await fetch(`/api/users/${user?.username}/profile`, {
                credentials: 'include',
            })
            if (!response.ok) {
                throw new Error('Failed to fetch profile')
            }
            return response.json()
        },
        enabled: !!user?.username,
    })

    const updateProfileMutation = useMutation({
        mutationFn: async (data: { autoAcceptFollowers?: boolean }) => {
            const response = await fetch('/api/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(data),
            })
            if (!response.ok) {
                throw new Error('Failed to update settings')
            }
            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.users.profile(user?.username || '') })
        },
    })

    const [autoAccept, setAutoAccept] = useState(profile?.autoAcceptFollowers ?? true)

    const handleToggleAutoAccept = async () => {
        const newValue = !autoAccept
        setAutoAccept(newValue)
        try {
            await updateProfileMutation.mutateAsync({ autoAcceptFollowers: newValue })
        } catch (error) {
            // Revert on error
            console.error('Failed to update auto-accept setting:', error)
            setAutoAccept(!newValue)
            alert('Failed to update setting')
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar isConnected={false} user={user} onLogout={logout} />
                <div className="max-w-4xl mx-auto px-4 py-8">
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar isConnected={false} user={user} onLogout={logout} />
            <div className="max-w-4xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Privacy</h2>

                    <div className="flex items-center justify-between py-4 border-b border-gray-200">
                        <div className="flex-1">
                            <h3 className="font-medium text-gray-900">Auto-accept followers</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Automatically accept follow requests. When disabled, you'll need to manually approve each follower.
                            </p>
                        </div>
                        <button
                            onClick={handleToggleAutoAccept}
                            disabled={updateProfileMutation.isPending}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${autoAccept ? 'bg-blue-600' : 'bg-gray-200'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoAccept ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

