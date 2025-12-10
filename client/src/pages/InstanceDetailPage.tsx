import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Navbar } from '../components/Navbar'
import { InstanceStats } from '../components/InstanceStats'
import { Container } from '../components/layout/Container'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { useAuth } from '../contexts/AuthContext'
import { useInstanceDetail, useBlockInstance, useUnblockInstance, useRefreshInstance } from '../hooks/queries'
import { queryKeys } from '../hooks/queries/keys'
import { setSEOMetadata } from '../lib/seo'

export function InstanceDetailPage() {
    const { domain } = useParams<{ domain: string }>()
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    
    // Fetch user profile to check admin status
    const { data: userProfile } = useQuery({
        queryKey: queryKeys.users.currentProfile(user?.id),
        queryFn: async () => {
            if (!user?.id) return null
            const response = await fetch('/api/users/me/profile', {
                credentials: 'include',
            })
            if (!response.ok) return null
            return response.json()
        },
        enabled: !!user?.id,
    })
    
    const isAdmin = userProfile?.isAdmin || false

    const { data: instance, isLoading, error } = useInstanceDetail(domain || '')
    const blockMutation = useBlockInstance(domain || '')
    const unblockMutation = useUnblockInstance(domain || '')
    const refreshMutation = useRefreshInstance(domain || '')

    useEffect(() => {
        if (instance) {
            setSEOMetadata({
                title: `${instance.title || instance.domain} - Instance Details`,
                description: instance.description || `Details for ${instance.domain}`,
            })
        }
    }, [instance])

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Never'
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    const handleBlock = () => {
        if (confirm(`Are you sure you want to block ${domain}?`)) {
            blockMutation.mutate(undefined, {
                onSuccess: () => {
                    navigate('/instances')
                },
            })
        }
    }

    const handleUnblock = () => {
        if (confirm(`Are you sure you want to unblock ${domain}?`)) {
            unblockMutation.mutate(undefined)
        }
    }

    const handleRefresh = () => {
        refreshMutation.mutate(undefined)
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                <Navbar user={user} onLogout={logout} />
                <Container className="py-8">
                    <div className="text-center py-12">
                        <p className="text-gray-600 dark:text-gray-400">Loading instance details...</p>
                    </div>
                </Container>
            </div>
        )
    }

    if (error || !instance) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                <Navbar user={user} onLogout={logout} />
                <Container className="py-8">
                    <div className="text-center py-12">
                        <p className="text-gray-600 dark:text-gray-400">
                            {error instanceof Error ? error.message : 'Instance not found'}
                        </p>
                        <Button variant="secondary" onClick={() => navigate('/instances')} className="mt-4">
                            Back to Instances
                        </Button>
                    </div>
                </Container>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <Navbar user={user} onLogout={logout} />
            <Container className="py-8">
                {/* Back Button */}
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate('/instances')}
                    className="mb-6"
                >
                    ← Back to Instances
                </Button>

                {/* Header */}
                <Card className="p-6 mb-6">
                    <div className="flex items-start gap-4">
                        <Avatar
                            src={instance.iconUrl}
                            alt={instance.title || instance.domain}
                            size="lg"
                            fallback={instance.domain.substring(0, 2).toUpperCase()}
                        />
                        <div className="flex-1">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                                        {instance.title || instance.domain}
                                    </h1>
                                    <p className="text-lg text-gray-600 dark:text-gray-400 mt-1">
                                        {instance.domain}
                                    </p>
                                </div>
                                {instance.isBlocked && (
                                    <Badge variant="error">Blocked</Badge>
                                )}
                            </div>

                            {instance.description && (
                                <p className="mt-4 text-gray-700 dark:text-gray-300">
                                    {instance.description}
                                </p>
                            )}

                            {/* Software Info */}
                            {instance.software && (
                                <div className="mt-4">
                                    <Badge variant="secondary">
                                        {instance.software}
                                        {instance.version && ` ${instance.version}`}
                                    </Badge>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Stats */}
                <Card className="p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        Statistics
                    </h2>
                    <InstanceStats instance={instance} />
                </Card>

                {/* Details */}
                <Card className="p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        Details
                    </h2>
                    <div className="space-y-3 text-sm">
                        <div>
                            <span className="font-semibold text-gray-700 dark:text-gray-300">
                                Last Activity:
                            </span>{' '}
                            <span className="text-gray-600 dark:text-gray-400">
                                {formatDate(instance.lastActivityAt)}
                            </span>
                        </div>
                        {instance.lastFetchedAt && (
                            <div>
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    Last Fetched:
                                </span>{' '}
                                <span className="text-gray-600 dark:text-gray-400">
                                    {formatDate(instance.lastFetchedAt)}
                                </span>
                            </div>
                        )}
                        {instance.createdAt && (
                            <div>
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    Created:
                                </span>{' '}
                                <span className="text-gray-600 dark:text-gray-400">
                                    {formatDate(instance.createdAt)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Error Info */}
                    {instance.lastError && (
                        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
                            <span className="font-semibold">Last Error:</span> {instance.lastError}
                        </div>
                    )}
                </Card>

                {/* Admin Actions */}
                {isAdmin && (
                    <Card className="p-6">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                            Admin Actions
                        </h2>
                        <div className="flex gap-2">
                            {instance.isBlocked ? (
                                <Button
                                    variant="secondary"
                                    onClick={handleUnblock}
                                    disabled={unblockMutation.isPending}
                                >
                                    {unblockMutation.isPending ? 'Unblocking...' : 'Unblock Instance'}
                                </Button>
                            ) : (
                                <Button
                                    variant="danger"
                                    onClick={handleBlock}
                                    disabled={blockMutation.isPending}
                                >
                                    {blockMutation.isPending ? 'Blocking...' : 'Block Instance'}
                                </Button>
                            )}
                            <Button
                                variant="secondary"
                                onClick={handleRefresh}
                                disabled={refreshMutation.isPending}
                            >
                                {refreshMutation.isPending ? 'Refreshing...' : 'Refresh Instance'}
                            </Button>
                        </div>
                    </Card>
                )}
            </Container>
        </div>
    )
}
