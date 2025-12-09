import { useState } from 'react'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../contexts/AuthContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { queryKeys } from '../hooks/queries/keys'

interface User {
    id: string
    username: string
    email?: string
    name?: string
    isAdmin: boolean
    isBot: boolean
    isRemote: boolean
    displayColor?: string
    bio?: string
    createdAt: string
    _count?: {
        events: number
        followers: number
        following: number
    }
}

interface ApiKey {
    id: string
    name: string
    description?: string
    prefix: string
    userId: string
    user: {
        id: string
        username: string
        name?: string
    }
    createdAt: string
    lastUsedAt?: string
}

interface Instance {
    id: string
    domain: string
    baseUrl: string
    software?: string
    version?: string
    title?: string
    description?: string
    iconUrl?: string
    userCount?: number
    eventCount?: number
    lastActivityAt?: string
    isBlocked: boolean
    lastFetchedAt?: string
    lastErrorAt?: string
    lastError?: string
    stats?: {
        remoteUsers: number
        remoteEvents: number
        localFollowing: number
    }
}

export function AdminPage() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [activeTab, setActiveTab] = useState<'users' | 'api-keys' | 'instances'>('users')
    const [showCreateUserModal, setShowCreateUserModal] = useState(false)
    const [showCreateApiKeyModal, setShowCreateApiKeyModal] = useState(false)
    const [, setSelectedUserId] = useState<string | null>(null)
    const [newApiKey, setNewApiKey] = useState<string | null>(null)

    // Check if user is admin
    const { data: userProfile, isLoading: isLoadingProfile } = useQuery({
        queryKey: queryKeys.users.currentProfile(user?.id),
        queryFn: async () => {
            if (!user) return null
            const response = await fetch(`/api/users/me/profile`, {
                credentials: 'include',
            })
            if (!response.ok) {
                throw new Error('Failed to fetch profile')
            }
            return response.json()
        },
        enabled: !!user,
    })

    // Redirect if not admin
    if (userProfile && !userProfile.isAdmin) {
        navigate('/')
        return null
    }

    // Fetch users
    const { data: usersData, isLoading: isLoadingUsers, refetch: refetchUsers } = useQuery({
        queryKey: ['admin-users'],
        queryFn: async () => {
            const response = await fetch('/api/admin/users', {
                credentials: 'include',
            })
            if (!response.ok) {
                throw new Error('Failed to fetch users')
            }
            const data = await response.json() as { users: User[]; pagination: { page: number; limit: number; total: number; pages: number } }
            console.log('[AdminPage] Fetched users:', data.users.length, 'users:', data.users.map(u => ({ username: u.username, isBot: u.isBot })))
            return data
        },
        enabled: activeTab === 'users' && !!userProfile?.isAdmin,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
    })

    // Fetch API keys
    const { data: apiKeysData, isLoading: isLoadingApiKeys } = useQuery({
        queryKey: ['admin-api-keys'],
        queryFn: async () => {
            const response = await fetch('/api/admin/api-keys', {
                credentials: 'include',
            })
            if (!response.ok) {
                throw new Error('Failed to fetch API keys')
            }
            return response.json() as Promise<{ apiKeys: ApiKey[] }>
        },
        enabled: activeTab === 'api-keys' && !!userProfile?.isAdmin,
    })

    // Fetch instances
    const { data: instancesData, isLoading: isLoadingInstances, refetch: refetchInstances } = useQuery({
        queryKey: ['admin-instances'],
        queryFn: async () => {
            const response = await fetch('/api/instances?limit=100&sortBy=activity', {
                credentials: 'include',
            })
            if (!response.ok) {
                throw new Error('Failed to fetch instances')
            }
            return response.json() as Promise<{ instances: Instance[]; total: number }>
        },
        enabled: activeTab === 'instances' && !!userProfile?.isAdmin,
    })

    // Create user mutation
    const createUserMutation = useMutation({
        mutationFn: async (data: {
            username: string
            email?: string
            name?: string
            isAdmin?: boolean
            isBot?: boolean
            password?: string
        }) => {
            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            })
            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to create user')
            }
            return response.json()
        },
        onSuccess: async () => {
            // Invalidate and refetch to ensure we get the latest data
            setShowCreateUserModal(false)
            // Small delay to ensure backend has processed the creation
            setTimeout(async () => {
                await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
                await queryClient.refetchQueries({ queryKey: ['admin-users'] })
            }, 100)
        },
    })

    // Create API key mutation
    const createApiKeyMutation = useMutation({
        mutationFn: async (data: { userId: string; name: string; description?: string }) => {
            const response = await fetch('/api/admin/api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            })
            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to create API key')
            }
            return response.json()
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['admin-api-keys'] })
            setNewApiKey(data.key)
            setShowCreateApiKeyModal(false)
        },
    })

    // Delete user mutation
    const deleteUserMutation = useMutation({
        mutationFn: async (userId: string) => {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                credentials: 'include',
            })
            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to delete user')
            }
            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] })
        },
    })

    // Delete API key mutation
    const deleteApiKeyMutation = useMutation({
        mutationFn: async (keyId: string) => {
            const response = await fetch(`/api/admin/api-keys/${keyId}`, {
                method: 'DELETE',
                credentials: 'include',
            })
            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to delete API key')
            }
            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-api-keys'] })
        },
    })

    if (isLoadingProfile) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar isConnected={false} user={user} onLogout={logout} />
                <div className="max-w-6xl mx-auto px-4 py-8">
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
            <div className="max-w-6xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Panel</h1>

                {/* Tabs */}
                <div className="border-b border-gray-200 mb-6">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'users'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Users
                        </button>
                        <button
                            onClick={() => setActiveTab('api-keys')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'api-keys'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            API Keys
                        </button>
                        <button
                            onClick={() => setActiveTab('instances')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'instances'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Instances
                        </button>
                    </nav>
                </div>

                {/* Users Tab */}
                {activeTab === 'users' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => refetchUsers()}
                                    className="btn btn-secondary"
                                    disabled={isLoadingUsers}
                                >
                                    Refresh
                                </button>
                                <button
                                    onClick={() => setShowCreateUserModal(true)}
                                    className="btn btn-primary"
                                >
                                    Create User
                                </button>
                            </div>
                        </div>

                        {isLoadingUsers ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                User
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Type
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Stats
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Created
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {usersData?.users.map((user) => (
                                            <tr key={user.id}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {user.username}
                                                        </div>
                                                        {user.email && (
                                                            <div className="text-sm text-gray-500">{user.email}</div>
                                                        )}
                                                        {user.name && (
                                                            <div className="text-sm text-gray-500">{user.name}</div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex gap-2">
                                                        {user.isAdmin && (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                                Admin
                                                            </span>
                                                        )}
                                                        {user.isBot && (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                                Bot
                                                            </span>
                                                        )}
                                                        {user.isRemote && (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                                Remote
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {user._count && (
                                                        <div>
                                                            {user._count.events} events, {user._count.followers}{' '}
                                                            followers
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {new Date(user.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button
                                                        onClick={() => {
                                                            if (confirm('Are you sure you want to delete this user?')) {
                                                                deleteUserMutation.mutate(user.id)
                                                            }
                                                        }}
                                                        className="text-red-600 hover:text-red-900"
                                                        disabled={deleteUserMutation.isPending}
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* API Keys Tab */}
                {activeTab === 'api-keys' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-gray-900">API Key Management</h2>
                            <button
                                onClick={() => {
                                    setSelectedUserId(null)
                                    setShowCreateApiKeyModal(true)
                                }}
                                className="btn btn-primary"
                            >
                                Create API Key
                            </button>
                        </div>

                        {isLoadingApiKeys ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Name
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                User
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Key
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Last Used
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {apiKeysData?.apiKeys.map((key) => (
                                            <tr key={key.id}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {key.name}
                                                        </div>
                                                        {key.description && (
                                                            <div className="text-sm text-gray-500">{key.description}</div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {key.user.username}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                                                    {key.prefix}...
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {key.lastUsedAt
                                                        ? new Date(key.lastUsedAt).toLocaleString()
                                                        : 'Never'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button
                                                        onClick={() => {
                                                            if (confirm('Are you sure you want to revoke this API key?')) {
                                                                deleteApiKeyMutation.mutate(key.id)
                                                            }
                                                        }}
                                                        className="text-red-600 hover:text-red-900"
                                                        disabled={deleteApiKeyMutation.isPending}
                                                    >
                                                        Revoke
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Instances Tab */}
                {activeTab === 'instances' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-gray-900">Federated Instances</h2>
                            <button
                                onClick={() => refetchInstances()}
                                className="btn btn-secondary"
                                disabled={isLoadingInstances}
                            >
                                Refresh
                            </button>
                        </div>

                        {isLoadingInstances ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            </div>
                        ) : (
                            <>
                                <div className="mb-4 text-sm text-gray-600">
                                    {instancesData?.total || 0} known instance(s) discovered through federation
                                </div>
                                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Instance
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Software
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Users
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Connections
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Last Activity
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {instancesData?.instances.map((instance) => (
                                                <tr key={instance.id}>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center">
                                                            {instance.iconUrl && (
                                                                <img
                                                                    src={instance.iconUrl}
                                                                    alt={instance.domain}
                                                                    className="h-8 w-8 rounded mr-3"
                                                                    onError={(e) => e.currentTarget.style.display = 'none'}
                                                                />
                                                            )}
                                                            <div>
                                                                <div className="text-sm font-medium text-gray-900">
                                                                    {instance.title || instance.domain}
                                                                </div>
                                                                <div className="text-sm text-gray-500">
                                                                    {instance.domain}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">
                                                            {instance.software || 'Unknown'}
                                                        </div>
                                                        {instance.version && (
                                                            <div className="text-sm text-gray-500">
                                                                v{instance.version}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">
                                                            {instance.userCount?.toLocaleString() || 'N/A'}
                                                        </div>
                                                        {instance.eventCount !== undefined && (
                                                            <div className="text-sm text-gray-500">
                                                                {instance.eventCount.toLocaleString()} posts
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">
                                                            {instance.stats?.remoteUsers || 0} cached users
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            {instance.stats?.remoteEvents || 0} events,{' '}
                                                            {instance.stats?.localFollowing || 0} following
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {instance.lastActivityAt
                                                            ? new Date(instance.lastActivityAt).toLocaleDateString()
                                                            : 'Never'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Create User Modal */}
                {showCreateUserModal && (
                    <CreateUserModal
                        onClose={() => setShowCreateUserModal(false)}
                        onCreate={(data) => createUserMutation.mutate(data)}
                        isPending={createUserMutation.isPending}
                        error={createUserMutation.error?.message}
                    />
                )}

                {/* Create API Key Modal */}
                {showCreateApiKeyModal && (
                    <CreateApiKeyModal
                        onClose={() => {
                            setShowCreateApiKeyModal(false)
                            setNewApiKey(null)
                        }}
                        onCreate={(data) => createApiKeyMutation.mutate(data)}
                        isPending={createApiKeyMutation.isPending}
                        error={createApiKeyMutation.error?.message}
                        users={usersData?.users || []}
                    />
                )}

                {/* New API Key Display Modal */}
                {newApiKey && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 max-w-md w-full">
                            <h3 className="text-lg font-semibold mb-4">API Key Created</h3>
                            <p className="text-sm text-gray-600 mb-4">
                                Save this key now. You will not be able to see it again.
                            </p>
                            <div
                                id="api-key-display"
                                className="bg-gray-100 p-4 rounded font-mono text-sm break-all mb-4 select-all cursor-text"
                                onClick={(e) => {
                                    // Select all text when clicking on the key
                                    const range = document.createRange()
                                    range.selectNodeContents(e.currentTarget)
                                    const selection = window.getSelection()
                                    selection?.removeAllRanges()
                                    selection?.addRange(range)
                                }}
                            >
                                {newApiKey}
                            </div>
                            <button
                                onClick={async () => {
                                    try {
                                        // Try modern clipboard API first
                                        if (navigator.clipboard && navigator.clipboard.writeText) {
                                            await navigator.clipboard.writeText(newApiKey)
                                            alert('Copied to clipboard!')
                                        } else {
                                            // Fallback: create temporary textarea and copy
                                            const textarea = document.createElement('textarea')
                                            textarea.value = newApiKey
                                            textarea.style.position = 'fixed'
                                            textarea.style.opacity = '0'
                                            document.body.appendChild(textarea)
                                            textarea.select()
                                            try {
                                                document.execCommand('copy')
                                                alert('Copied to clipboard!')
                                            } catch (err) {
                                                console.error('Failed to copy to clipboard:', err)
                                                // Fallback: select the text so user can manually copy
                                                textarea.style.position = 'static'
                                                textarea.style.opacity = '1'
                                                textarea.focus()
                                                textarea.select()
                                                alert('Please manually copy the text above')
                                            }
                                            document.body.removeChild(textarea)
                                        }
                                    } catch (err) {
                                        console.error('Failed to copy:', err)
                                        // Fallback: select the text in the display div
                                        const keyDiv = document.getElementById('api-key-display')
                                        if (keyDiv) {
                                            const range = document.createRange()
                                            range.selectNodeContents(keyDiv)
                                            const selection = window.getSelection()
                                            selection?.removeAllRanges()
                                            selection?.addRange(range)
                                            alert('Text selected - press Ctrl+C (or Cmd+C) to copy')
                                        } else {
                                            alert('Failed to copy. Please manually select and copy the key above.')
                                        }
                                    }
                                }}
                                className="btn btn-secondary w-full mb-2"
                            >
                                Copy to Clipboard
                            </button>
                            <button
                                onClick={() => setNewApiKey(null)}
                                className="btn btn-primary w-full"
                            >
                                I've Saved It
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function CreateUserModal({
    onClose,
    onCreate,
    isPending,
    error,
}: {
    onClose: () => void
    onCreate: (data: {
        username: string
        email?: string
        name?: string
        isAdmin?: boolean
        isBot?: boolean
        password?: string
    }) => void
    isPending: boolean
    error?: string
}) {
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [name, setName] = useState('')
    const [isAdmin, setIsAdmin] = useState(false)
    const [isBot, setIsBot] = useState(false)
    const [password, setPassword] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onCreate({
            username,
            email: email || undefined,
            name: name || undefined,
            isAdmin,
            isBot,
            password: isBot ? undefined : password,
        })
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-semibold mb-4">Create User</h3>
                {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Username *
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                    </div>
                    <div className="mb-4">
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={isBot}
                                onChange={(e) => setIsBot(e.target.checked)}
                                className="mr-2"
                            />
                            <span className="text-sm text-gray-700">Bot User</span>
                        </label>
                    </div>
                    {!isBot && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Password *
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={8}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                    )}
                    <div className="mb-4">
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={isAdmin}
                                onChange={(e) => setIsAdmin(e.target.checked)}
                                className="mr-2"
                            />
                            <span className="text-sm text-gray-700">Admin</span>
                        </label>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-secondary flex-1"
                            disabled={isPending}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary flex-1" disabled={isPending}>
                            {isPending ? 'Creating...' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function CreateApiKeyModal({
    onClose,
    onCreate,
    isPending,
    error,
    users,
}: {
    onClose: () => void
    onCreate: (data: { userId: string; name: string; description?: string }) => void
    isPending: boolean
    error?: string
    users: User[]
}) {
    const [userId, setUserId] = useState('')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onCreate({
            userId,
            name,
            description: description || undefined,
        })
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-semibold mb-4">Create API Key</h3>
                {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            User *
                        </label>
                        <select
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                            <option value="">Select a user</option>
                            {users.map((user) => (
                                <option key={user.id} value={user.id}>
                                    {user.username} {user.isBot && '(Bot)'}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            rows={3}
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-secondary flex-1"
                            disabled={isPending}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary flex-1" disabled={isPending}>
                            {isPending ? 'Creating...' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

