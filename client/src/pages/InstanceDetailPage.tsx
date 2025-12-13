import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

import { Container } from '@/components/layout'
import { Card, Button, Badge, Avatar, Spinner } from '@/components/ui'
import {
	useInstanceDetail,
	useBlockInstance,
	useUnblockInstance,
	useRefreshInstance,
	queryKeys,
} from '@/hooks/queries'
import { api } from '@/lib/api-client'
import type { UserProfile } from '@/types'

import { ConfirmationModal } from '../components/ConfirmationModal'
import { InstanceStats } from '../components/InstanceStats'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../hooks/useAuth'
import { setSEOMetadata } from '../lib/seo'

export function InstanceDetailPage() {
	const { domain } = useParams<{ domain: string }>()
	const navigate = useNavigate()
	const { user, logout } = useAuth()
	const [showBlockConfirm, setShowBlockConfirm] = useState(false)
	const [showUnblockConfirm, setShowUnblockConfirm] = useState(false)

	// Fetch user profile to check admin status
	const { data: userProfile } = useQuery<UserProfile | null>({
		queryKey: queryKeys.users.currentProfile(user?.id),
		queryFn: async () => {
			if (!user?.id) {
				return null
			}
			try {
				return await api.get<UserProfile>(
					'/users/me/profile',
					undefined,
					undefined,
					'Failed to fetch profile'
				)
			} catch {
				return null
			}
		},
		enabled: Boolean(user?.id),
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
		if (!dateString) {
			return 'Never'
		}
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
		setShowBlockConfirm(true)
	}

	const confirmBlock = () => {
		setShowBlockConfirm(false)
		blockMutation.mutate(undefined, {
			onSuccess: () => {
				navigate('/instances')
			},
		})
	}

	const handleUnblock = () => {
		setShowUnblockConfirm(true)
	}

	const confirmUnblock = () => {
		setShowUnblockConfirm(false)
		unblockMutation.mutate(undefined)
	}

	const handleRefresh = () => {
		refreshMutation.mutate(undefined)
	}

	if (isLoading) {
		return (
			<div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
				<Navbar user={user} onLogout={logout} />
				<Container className="py-8">
					<div className="flex flex-col items-center justify-center py-12">
						<Spinner size="lg" />
						<p className="mt-4 text-neutral-600 dark:text-neutral-400">
							Loading instance details...
						</p>
					</div>
				</Container>
			</div>
		)
	}

	if (error || !instance) {
		return (
			<div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
				<Navbar user={user} onLogout={logout} />
				<Container className="py-8">
					<div className="text-center py-12">
						<p className="text-neutral-600 dark:text-neutral-400">
							{error instanceof Error ? error.message : 'Instance not found'}
						</p>
						<Button
							variant="secondary"
							onClick={() => navigate('/instances')}
							className="mt-4">
							Back to Instances
						</Button>
					</div>
				</Container>
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
			<Navbar user={user} onLogout={logout} />
			<Container className="py-8">
				{/* Back Button */}
				<Button
					variant="secondary"
					size="sm"
					onClick={() => navigate('/instances')}
					className="mb-6">
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
									<h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
										{instance.title || instance.domain}
									</h1>
									<p className="text-lg text-neutral-600 dark:text-neutral-400 mt-1">
										{instance.domain}
									</p>
								</div>
								{instance.isBlocked && <Badge variant="error">Blocked</Badge>}
							</div>

							{instance.description && (
								<p className="mt-4 text-neutral-700 dark:text-neutral-300">
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
					<h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
						Statistics
					</h2>
					<InstanceStats instance={instance} />
				</Card>

				{/* Details */}
				<Card className="p-6 mb-6">
					<h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
						Details
					</h2>
					<div className="space-y-3 text-sm">
						<div>
							<span className="font-semibold text-neutral-700 dark:text-neutral-300">
								Last Activity:
							</span>{' '}
							<span className="text-neutral-600 dark:text-neutral-400">
								{formatDate(instance.lastActivityAt)}
							</span>
						</div>
						{instance.lastFetchedAt && (
							<div>
								<span className="font-semibold text-neutral-700 dark:text-neutral-300">
									Last Fetched:
								</span>{' '}
								<span className="text-neutral-600 dark:text-neutral-400">
									{formatDate(instance.lastFetchedAt)}
								</span>
							</div>
						)}
						{instance.createdAt && (
							<div>
								<span className="font-semibold text-neutral-700 dark:text-neutral-300">
									Created:
								</span>{' '}
								<span className="text-neutral-600 dark:text-neutral-400">
									{formatDate(instance.createdAt)}
								</span>
							</div>
						)}
					</div>

					{/* Error Info */}
					{instance.lastError && (
						<div className="mt-4 p-4 bg-error-50 dark:bg-error-900/20 rounded text-sm text-error-600 dark:text-error-400">
							<span className="font-semibold">Last Error:</span> {instance.lastError}
						</div>
					)}
				</Card>

				{/* Admin Actions */}
				{isAdmin && (
					<Card className="p-6">
						<h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
							Admin Actions
						</h2>
						<div className="flex gap-2">
							{instance.isBlocked ? (
								<Button
									variant="secondary"
									onClick={handleUnblock}
									disabled={unblockMutation.isPending}>
									{unblockMutation.isPending
										? 'Unblocking...'
										: 'Unblock Instance'}
								</Button>
							) : (
								<Button
									variant="danger"
									onClick={handleBlock}
									disabled={blockMutation.isPending}>
									{blockMutation.isPending ? 'Blocking...' : 'Block Instance'}
								</Button>
							)}
							<Button
								variant="secondary"
								onClick={handleRefresh}
								disabled={refreshMutation.isPending}>
								{refreshMutation.isPending ? 'Refreshing...' : 'Refresh Instance'}
							</Button>
						</div>
					</Card>
				)}
			</Container>

			{/* Block Confirmation */}
			<ConfirmationModal
				isOpen={showBlockConfirm}
				title="Block Instance"
				message={`Are you sure you want to block ${domain}?`}
				confirmLabel="Block"
				cancelLabel="Cancel"
				variant="danger"
				onConfirm={confirmBlock}
				onCancel={() => setShowBlockConfirm(false)}
				isPending={blockMutation.isPending}
			/>

			{/* Unblock Confirmation */}
			<ConfirmationModal
				isOpen={showUnblockConfirm}
				title="Unblock Instance"
				message={`Are you sure you want to unblock ${domain}?`}
				confirmLabel="Unblock"
				cancelLabel="Cancel"
				variant="default"
				onConfirm={confirmUnblock}
				onCancel={() => setShowUnblockConfirm(false)}
				isPending={unblockMutation.isPending}
			/>
		</div>
	)
}
