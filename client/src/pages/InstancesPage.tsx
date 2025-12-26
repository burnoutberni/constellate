import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'

import { Container, Stack } from '@/components/layout'
import { Button, Input, Card, Spinner } from '@/components/ui'
import { useInstances, useInstanceSearch, queryKeys } from '@/hooks/queries'
import { api } from '@/lib/api-client'
import type { InstanceWithStats, UserProfile } from '@/types'

import { ConfirmationModal } from '../components/ConfirmationModal'
import { InstanceList } from '../components/InstanceList'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../hooks/useAuth'
import { setSEOMetadata } from '../lib/seo'

type SortOption = 'activity' | 'users' | 'created'

export function InstancesPage() {
	const { user, logout } = useAuth()
	const [searchQuery, setSearchQuery] = useState('')
	const [sortBy, setSortBy] = useState<SortOption>('activity')
	const [limit] = useState(50)
	const [offset, setOffset] = useState(0)
	const [blockDomain, setBlockDomain] = useState<string | null>(null)
	const [showBlocked, setShowBlocked] = useState(false)

	// Fetch user profile to check admin status
	const { data: userProfile } = useQuery<UserProfile | null>({
		queryKey: queryKeys.users.currentProfile(user?.id),
		queryFn: async () => {
			if (!user?.id) {return null}
			try {
				return await api.get<UserProfile>('/users/me/profile')
			} catch {
				return null
			}
		},
		enabled: Boolean(user?.id),
	})

	// Set SEO metadata
	useEffect(() => {
		setSEOMetadata({
			title: 'Federated Instances',
			description:
				'Discover and browse federated instances connected to this Constellate server',
		})
	}, [])

	// Fetch instances or search results
	const { data: instancesData, isLoading: isLoadingInstances } = useInstances({
		limit,
		offset,
		sortBy,
		includeBlocked: showBlocked,
	})

	const { data: searchData, isLoading: isSearching } = useInstanceSearch(searchQuery, 50)

	// Use search results if searching, otherwise use regular list
	const instances = searchQuery ? searchData?.instances || [] : instancesData?.instances || []
	const isLoading = searchQuery ? isSearching : isLoadingInstances
	const total = instancesData?.total || 0

	// Mutations for admin actions
	const queryClient = useQueryClient()

	const blockMutation = useMutation({
		mutationFn: (domain: string) =>
			api.post(
				`/instances/${encodeURIComponent(domain)}/block`,
				undefined,
				undefined,
				'Failed to block instance'
			),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.instances.all() })
		},
	})

	const unblockMutation = useMutation({
		mutationFn: (domain: string) =>
			api.post(
				`/instances/${encodeURIComponent(domain)}/unblock`,
				undefined,
				undefined,
				'Failed to unblock instance'
			),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.instances.all() })
		},
	})

	const refreshMutation = useMutation({
		mutationFn: (domain: string) =>
			api.post(
				`/instances/${encodeURIComponent(domain)}/refresh`,
				undefined,
				undefined,
				'Failed to refresh instance'
			),
		onSuccess: (_data, domain) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.instances.detail(domain) })
			queryClient.invalidateQueries({ queryKey: queryKeys.instances.all() })
		},
	})

	const handleBlock = (domain: string) => {
		setBlockDomain(domain)
	}

	const confirmBlock = () => {
		if (blockDomain) {
			blockMutation.mutate(blockDomain)
			setBlockDomain(null)
		}
	}

	const handleUnblock = (domain: string) => {
		unblockMutation.mutate(domain)
	}

	const handleRefresh = (domain: string) => {
		refreshMutation.mutate(domain)
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
		<div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
			<Navbar user={user} onLogout={logout} />

			<Container className="py-8">
				{/* Header */}
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
						Federated Instances
					</h1>
					<p className="mt-2 text-neutral-600 dark:text-neutral-400">
						Discover and browse federated instances connected to this server
					</p>
				</div>

				{/* Filters */}
				<Card className="p-6 mb-6">
					<Stack direction="column" directionMd="row" gap="md">
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
						<div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
							{!searchQuery && (
								<div className="flex gap-2">
									<Button
										variant={sortBy === 'activity' ? 'primary' : 'secondary'}
										size="sm"
										onClick={() => setSortBy('activity')}>
										Recent Activity
									</Button>
									<Button
										variant={sortBy === 'users' ? 'primary' : 'secondary'}
										size="sm"
										onClick={() => setSortBy('users')}>
										Most Users
									</Button>
									<Button
										variant={sortBy === 'created' ? 'primary' : 'secondary'}
										size="sm"
										onClick={() => setSortBy('created')}>
										Newest
									</Button>
								</div>
							)}

							{/* Show Blocked Toggle */}
							{userProfile?.isAdmin && (
								<div className="flex items-center gap-2">
									<input
										type="checkbox"
										id="showBlocked"
										className="rounded border-neutral-300 dark:border-neutral-600 text-primary-600 focus:ring-primary-500"
										checked={showBlocked}
										onChange={(e) => setShowBlocked(e.target.checked)}
									/>
									<label
										htmlFor="showBlocked"
										className="text-sm font-medium text-text-primary cursor-pointer select-none">
										Show Blocked
									</label>
								</div>
							)}
						</div>
					</Stack>
				</Card>

				{/* Stats */}
				{!searchQuery && instancesData && (
					<div className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
						Showing {offset + 1}-{Math.min(offset + limit, total)} of {total} instances
					</div>
				)}

				{/* Loading State */}
				{isLoading && (
					<div className="flex flex-col items-center justify-center py-12">
						<Spinner size="lg" />
						<p className="mt-4 text-neutral-600 dark:text-neutral-400">
							Loading instances...
						</p>
					</div>
				)}

				{/* Error State */}
				{!isLoading && instances.length === 0 && searchQuery && (
					<div className="text-center py-12">
						<p className="text-neutral-600 dark:text-neutral-400">
							No instances found matching &quot;{searchQuery}&quot;
						</p>
					</div>
				)}

				{/* Instance List */}
				{!isLoading && instances.length > 0 && (
					<InstanceList
						instances={instances.map((instance): InstanceWithStats => {
							// Convert Instance to InstanceWithStats by adding default stats
							if ('stats' in instance && instance.stats) {
								return instance as InstanceWithStats
							}
							return {
								...instance,
								stats: {
									remoteUsers: 0,
									remoteEvents: 0,
									localFollowing: 0,
								},
							}
						})}
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
							disabled={!hasPreviousPage}>
							Previous
						</Button>
						<Button
							variant="secondary"
							onClick={handleNextPage}
							disabled={!hasNextPage}>
							Next
						</Button>
					</div>
				)}
			</Container>

			{/* Block Confirmation */}
			<ConfirmationModal
				isOpen={blockDomain !== null}
				title="Block Instance"
				message={`Are you sure you want to block ${blockDomain}?`}
				confirmLabel="Block"
				cancelLabel="Cancel"
				variant="danger"
				onConfirm={confirmBlock}
				onCancel={() => setBlockDomain(null)}
				isPending={blockMutation.isPending}
			/>
		</div>
	)
}
