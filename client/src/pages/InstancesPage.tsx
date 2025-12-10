import { useState, useEffect } from 'react'
import { Navbar } from '../components/Navbar'
import { InstanceList } from '../components/InstanceList'
import { Container } from '../components/layout/Container'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { useAuth } from '../contexts/AuthContext'
import { useInstances, useInstanceSearch, useBlockInstance, useUnblockInstance, useRefreshInstance } from '../hooks/queries'
import { setSEOMetadata } from '../lib/seo'

type SortOption = 'activity' | 'users' | 'created'

export function InstancesPage() {
    const { user, logout } = useAuth()
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState<SortOption>('activity')
    const [limit] = useState(50)
    const [offset, setOffset] = useState(0)

    // Set SEO metadata
    useEffect(() => {
        setSEOMetadata({
            title: 'Federated Instances',
            description: 'Discover and browse federated instances connected to this Constellate server',
        })
    }, [])

    // Fetch instances or search results
    const { data: instancesData, isLoading: isLoadingInstances } = useInstances({
        limit,
        offset,
        sortBy,
    })

    const { data: searchData, isLoading: isSearching } = useInstanceSearch(searchQuery, 50)

    // Use search results if searching, otherwise use regular list
    const instances = searchQuery ? (searchData?.instances || []) : (instancesData?.instances || [])
    const isLoading = searchQuery ? isSearching : isLoadingInstances
    const total = instancesData?.total || 0

    // Mutations for admin actions
    const blockMutation = useBlockInstance('')
    const unblockMutation = useUnblockInstance('')
    const refreshMutation = useRefreshInstance('')

    const handleBlock = (domain: string) => {
        if (confirm(`Are you sure you want to block ${domain}?`)) {
            blockMutation.mutate(undefined, {
                mutationFn: async () => {
                    const response = await fetch(`/api/instances/${encodeURIComponent(domain)}/block`, {
                        method: 'POST',
                        credentials: 'include',
                    })
                    if (!response.ok) throw new Error('Failed to block instance')
                    return response.json()
                },
            })
        }
    }

    const handleUnblock = (domain: string) => {
        unblockMutation.mutate(undefined, {
            mutationFn: async () => {
                const response = await fetch(`/api/instances/${encodeURIComponent(domain)}/unblock`, {
                    method: 'POST',
                    credentials: 'include',
                })
                if (!response.ok) throw new Error('Failed to unblock instance')
                return response.json()
            },
        })
    }

    const handleRefresh = (domain: string) => {
        refreshMutation.mutate(undefined, {
            mutationFn: async () => {
                const response = await fetch(`/api/instances/${encodeURIComponent(domain)}/refresh`, {
                    method: 'POST',
                    credentials: 'include',
                })
                if (!response.ok) throw new Error('Failed to refresh instance')
                return response.json()
            },
        })
    }

    const handlePreviousPage = () => {
        setOffset(Math.max(0, offset - limit))
    }

    const handleNextPage = () => {
        setOffset(offset + limit)
    }

    const hasNextPage = offset + limit < total
    const hasPreviousPage = offset > 0

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <Navbar user={user} onLogout={logout} />

            <Container className="py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                        Federated Instances
                    </h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        Discover and browse federated instances connected to this server
                    </p>
                </div>

                {/* Filters */}
                <Card className="p-6 mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="flex-1">
                            <Input
                                type="text"
                                placeholder="Search instances by domain, title, or description..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Sort */}
                        {!searchQuery && (
                            <div className="flex gap-2">
                                <Button
                                    variant={sortBy === 'activity' ? 'primary' : 'secondary'}
                                    size="sm"
                                    onClick={() => setSortBy('activity')}
                                >
                                    Recent Activity
                                </Button>
                                <Button
                                    variant={sortBy === 'users' ? 'primary' : 'secondary'}
                                    size="sm"
                                    onClick={() => setSortBy('users')}
                                >
                                    Most Users
                                </Button>
                                <Button
                                    variant={sortBy === 'created' ? 'primary' : 'secondary'}
                                    size="sm"
                                    onClick={() => setSortBy('created')}
                                >
                                    Newest
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Stats */}
                {!searchQuery && instancesData && (
                    <div className="mb-6 text-sm text-gray-600 dark:text-gray-400">
                        Showing {offset + 1}-{Math.min(offset + limit, total)} of {total} instances
                    </div>
                )}

                {/* Loading State */}
                {isLoading && (
                    <div className="text-center py-12">
                        <p className="text-gray-600 dark:text-gray-400">Loading instances...</p>
                    </div>
                )}

                {/* Error State */}
                {!isLoading && instances.length === 0 && searchQuery && (
                    <div className="text-center py-12">
                        <p className="text-gray-600 dark:text-gray-400">
                            No instances found matching "{searchQuery}"
                        </p>
                    </div>
                )}

                {/* Instance List */}
                {!isLoading && instances.length > 0 && (
                    <InstanceList
                        instances={instances}
                        onBlock={handleBlock}
                        onUnblock={handleUnblock}
                        onRefresh={handleRefresh}
                    />
                )}

                {/* Pagination */}
                {!searchQuery && !isLoading && instances.length > 0 && (
                    <div className="mt-8 flex justify-center gap-4">
                        <Button
                            variant="secondary"
                            onClick={handlePreviousPage}
                            disabled={!hasPreviousPage}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={handleNextPage}
                            disabled={!hasNextPage}
                        >
                            Next
                        </Button>
                    </div>
                )}
            </Container>
        </div>
    )
}
