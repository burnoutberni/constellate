import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { AppealQueue } from '@/components/admin/AppealQueue'
import { ReportQueue } from '@/components/admin/ReportQueue'
import { Input, Button, Textarea, Modal, Spinner, GlobeIcon } from '@/components/ui'
import { queryKeys } from '@/hooks/queries'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { api } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { generateId } from '@/lib/utils'
import { useUIStore } from '@/stores'
import type { UserProfile } from '@/types'

import { ConfirmationModal } from '../components/ConfirmationModal'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../hooks/useAuth'

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

type AdminTab = 'users' | 'api-keys' | 'instances' | 'reports' | 'appeals'

export function AdminPage() {
	const { user, logout } = useAuth()
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const handleError = useErrorHandler()
	const addToast = useUIStore((state) => state.addToast)
	const [activeTab, setActiveTab] = useState<AdminTab>('users')
	const [showCreateUserModal, setShowCreateUserModal] = useState(false)
	const [showCreateApiKeyModal, setShowCreateApiKeyModal] = useState(false)
	const [, setSelectedUserId] = useState<string | null>(null)
	const [newApiKey, setNewApiKey] = useState<string | null>(null)
	const [deleteUserId, setDeleteUserId] = useState<string | null>(null)
	const [revokeApiKeyId, setRevokeApiKeyId] = useState<string | null>(null)

	// Check if user is admin
	const { data: userProfile, isLoading: isLoadingProfile } = useQuery<UserProfile | null>({
		queryKey: queryKeys.users.currentProfile(user?.id),
		queryFn: async () => {
			if (!user) {
				return null
			}
			return api.get<UserProfile>(
				'/users/me/profile',
				undefined,
				undefined,
				'Failed to fetch profile'
			)
		},
		enabled: Boolean(user),
	})

	// Fetch users
	const {
		data: usersData,
		isLoading: isLoadingUsers,
		refetch: refetchUsers,
	} = useQuery({
		queryKey: queryKeys.admin.users(),
		queryFn: async () => {
			return api.get<{
				users: User[]
				pagination: { page: number; limit: number; total: number; pages: number }
			}>('/admin/users', undefined, undefined, 'Failed to fetch users')
		},
		enabled: activeTab === 'users' && Boolean(userProfile?.isAdmin),
		refetchOnMount: true,
		refetchOnWindowFocus: false,
	})

	// Fetch API keys
	const { data: apiKeysData, isLoading: isLoadingApiKeys } = useQuery({
		queryKey: queryKeys.admin.apiKeys(),
		queryFn: async () => {
			return api.get<{ apiKeys: ApiKey[] }>(
				'/admin/api-keys',
				undefined,
				undefined,
				'Failed to fetch API keys'
			)
		},
		enabled: activeTab === 'api-keys' && Boolean(userProfile?.isAdmin),
	})

	// Fetch instances
	const {
		data: instancesData,
		isLoading: isLoadingInstances,
		refetch: refetchInstances,
	} = useQuery({
		queryKey: queryKeys.admin.instances(),
		queryFn: async () => {
			return api.get<{ instances: Instance[]; total: number }>(
				'/instances',
				{ limit: 100, sortBy: 'activity' },
				undefined,
				'Failed to fetch instances'
			)
		},
		enabled: activeTab === 'instances' && Boolean(userProfile?.isAdmin),
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
			return api.post('/admin/users', data, undefined, 'Failed to create user')
		},
		onSuccess: async () => {
			// Invalidate and refetch to ensure we get the latest data
			setShowCreateUserModal(false)
			// Small delay to ensure backend has processed the creation
			setTimeout(async () => {
				await queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() })
				await queryClient.refetchQueries({ queryKey: queryKeys.admin.users() })
			}, 100)
		},
	})

	// Create API key mutation
	const createApiKeyMutation = useMutation<
		{ key: string },
		unknown,
		{ userId: string; name: string; description?: string }
	>({
		mutationFn: async (data: { userId: string; name: string; description?: string }) => {
			return api.post<{ key: string }>(
				'/admin/api-keys',
				data,
				undefined,
				'Failed to create API key'
			)
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.admin.apiKeys() })
			setNewApiKey(data.key)
			setShowCreateApiKeyModal(false)
		},
	})

	// Delete user mutation
	const deleteUserMutation = useMutation({
		mutationFn: async (userId: string) => {
			return api.delete(`/admin/users/${userId}`, undefined, 'Failed to delete user')
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() })
		},
	})

	// Delete API key mutation
	const deleteApiKeyMutation = useMutation({
		mutationFn: async (keyId: string) => {
			return api.delete(`/admin/api-keys/${keyId}`, undefined, 'Failed to delete API key')
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.admin.apiKeys() })
		},
	})

	// Redirect if not admin (after all hooks)
	if (userProfile && !userProfile.isAdmin) {
		navigate('/')
		return null
	}

	if (isLoadingProfile) {
		return (
			<div className="min-h-screen bg-background-secondary">
				<Navbar isConnected={false} user={user} onLogout={logout} />
				<div className="max-w-6xl mx-auto px-4 py-8">
					<div className="flex justify-center items-center py-12">
						<Spinner size="lg" />
					</div>
				</div>
			</div>
		)
	}

	const getTabClassName = (tab: AdminTab) =>
		`py-4 px-1 border-b-2 font-medium text-sm h-auto ${
			activeTab === tab
				? 'border-primary-500 text-primary-600 dark:text-primary-400'
				: 'border-transparent text-text-tertiary hover:text-text-primary hover:border-border-default'
		}`

	return (
		<div className="min-h-screen bg-background-secondary">
			<Navbar isConnected={false} user={user} onLogout={logout} />
			<div className="max-w-6xl mx-auto px-4 py-8">
				<h1 className="text-3xl font-bold text-text-primary mb-8">Admin Panel</h1>

				{/* Tabs */}
				<div className="border-b border-border-default mb-6">
					<nav className="-mb-px flex space-x-8">
						<Button
							onClick={() => setActiveTab('users')}
							variant="ghost"
							size="sm"
							className={getTabClassName('users')}>
							Users
						</Button>
						<Button
							onClick={() => setActiveTab('api-keys')}
							variant="ghost"
							size="sm"
							className={getTabClassName('api-keys')}>
							API Keys
						</Button>
						<Button
							onClick={() => setActiveTab('instances')}
							variant="ghost"
							size="sm"
							className={getTabClassName('instances')}>
							Instances
						</Button>
						<Button
							onClick={() => setActiveTab('reports')}
							variant="ghost"
							size="sm"
							className={getTabClassName('reports')}>
							Reports
						</Button>
						<Button
							onClick={() => setActiveTab('appeals')}
							variant="ghost"
							size="sm"
							className={getTabClassName('appeals')}>
							Appeals
						</Button>
					</nav>
				</div>

				{/* Users Tab */}
				{activeTab === 'users' && (
					<div>
						<div className="flex justify-between items-center mb-4">
							<h2 className="text-xl font-semibold text-text-primary">
								User Management
							</h2>
							<div className="flex gap-2">
								<Button
									onClick={() => refetchUsers()}
									variant="secondary"
									disabled={isLoadingUsers}
									loading={isLoadingUsers}>
									Refresh
								</Button>
								<Button
									onClick={() => setShowCreateUserModal(true)}
									variant="primary">
									Create User
								</Button>
							</div>
						</div>

						{isLoadingUsers ? (
							<div className="flex justify-center py-12">
								<Spinner size="md" />
							</div>
						) : (
							<div className="bg-background-primary rounded-lg shadow-sm overflow-hidden border border-border-default">
								<table className="min-w-full divide-y divide-border-default">
									<thead className="bg-background-secondary">
										<tr>
											<th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
												User
											</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
												Type
											</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
												Stats
											</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
												Created
											</th>
											<th className="px-6 py-3 text-right text-xs font-medium text-text-tertiary uppercase tracking-wider">
												Actions
											</th>
										</tr>
									</thead>
									<tbody className="bg-background-primary divide-y divide-border-default">
										{usersData?.users.map((userItem) => (
											<tr key={userItem.id}>
												<td className="px-6 py-4 whitespace-nowrap">
													<div>
														<div className="text-sm font-medium text-text-primary">
															{userItem.username}
														</div>
														{userItem.email && (
															<div className="text-sm text-text-secondary">
																{userItem.email}
															</div>
														)}
														{userItem.name && (
															<div className="text-sm text-text-secondary">
																{userItem.name}
															</div>
														)}
													</div>
												</td>
												<td className="px-6 py-4 whitespace-nowrap">
													<div className="flex gap-2">
														{userItem.isAdmin && (
															<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
																Admin
															</span>
														)}
														{userItem.isBot && (
															<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-info-100 text-info-800 dark:bg-info-900/30 dark:text-info-300">
																Bot
															</span>
														)}
														{userItem.isRemote && (
															<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300">
																Remote
															</span>
														)}
													</div>
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
													{userItem._count && (
														<div>
															{userItem._count.events} events,{' '}
															{userItem._count.followers} followers
														</div>
													)}
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
													{new Date(
														userItem.createdAt
													).toLocaleDateString()}
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
													<Button
														onClick={() => {
															setDeleteUserId(userItem.id)
														}}
														variant="ghost"
														size="sm"
														className="text-error-600 hover:text-error-900 dark:text-error-400 dark:hover:text-error-300"
														disabled={deleteUserMutation.isPending}>
														Delete
													</Button>
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
							<h2 className="text-xl font-semibold text-text-primary">
								API Key Management
							</h2>
							<Button
								onClick={() => {
									setSelectedUserId(null)
									setShowCreateApiKeyModal(true)
								}}
								variant="primary">
								Create API Key
							</Button>
						</div>

						{isLoadingApiKeys ? (
							<div className="flex justify-center py-12">
								<Spinner size="md" />
							</div>
						) : (
							<div className="bg-background-primary rounded-lg shadow-sm overflow-hidden border border-border-default">
								<table className="min-w-full divide-y divide-border-default">
									<thead className="bg-background-secondary">
										<tr>
											<th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
												Name
											</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
												User
											</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
												Key
											</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
												Last Used
											</th>
											<th className="px-6 py-3 text-right text-xs font-medium text-text-tertiary uppercase tracking-wider">
												Actions
											</th>
										</tr>
									</thead>
									<tbody className="bg-background-primary divide-y divide-border-default">
										{apiKeysData?.apiKeys.map((key) => (
											<tr key={key.id}>
												<td className="px-6 py-4 whitespace-nowrap">
													<div>
														<div className="text-sm font-medium text-text-primary">
															{key.name}
														</div>
														{key.description && (
															<div className="text-sm text-text-secondary">
																{key.description}
															</div>
														)}
													</div>
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
													{key.user.username}
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-text-secondary">
													{key.prefix}...
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
													{key.lastUsedAt
														? new Date(key.lastUsedAt).toLocaleString()
														: 'Never'}
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
													<Button
														onClick={() => {
															setRevokeApiKeyId(key.id)
														}}
														variant="ghost"
														size="sm"
														className="text-error-600 hover:text-error-900 dark:text-error-400 dark:hover:text-error-300"
														disabled={deleteApiKeyMutation.isPending}>
														Revoke
													</Button>
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
							<h2 className="text-xl font-semibold text-text-primary">
								Federated Instances
							</h2>
							<Button
								onClick={() => refetchInstances()}
								variant="secondary"
								disabled={isLoadingInstances}
								loading={isLoadingInstances}>
								Refresh
							</Button>
						</div>

						{isLoadingInstances ? (
							<div className="flex justify-center py-12">
								<Spinner size="md" />
							</div>
						) : (
							<>
								<div className="mb-4 text-sm text-text-secondary">
									{instancesData?.total || 0} known instance(s) discovered through
									federation
								</div>
								<div className="bg-background-primary rounded-lg shadow-sm overflow-hidden border border-border-default">
									{instancesData?.instances &&
									instancesData.instances.length > 0 ? (
										<table className="min-w-full divide-y divide-border-default">
											<thead className="bg-background-secondary">
												<tr>
													<th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
														Instance
													</th>
													<th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
														Software
													</th>
													<th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
														Users
													</th>
													<th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
														Connections
													</th>
													<th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
														Last Activity
													</th>
												</tr>
											</thead>
											<tbody className="bg-background-primary divide-y divide-border-default">
												{instancesData.instances.map((instance) => (
													<tr key={instance.id}>
														<td className="px-6 py-4 whitespace-nowrap">
															<div className="flex items-center">
																{instance.iconUrl && (
																	<img
																		src={instance.iconUrl}
																		alt={instance.domain}
																		className="h-8 w-8 rounded mr-3"
																		onError={(e) => {
																			e.currentTarget.style.display =
																				'none'
																		}}
																	/>
																)}
																<div>
																	<div className="text-sm font-medium text-text-primary">
																		{instance.title ||
																			instance.domain}
																	</div>
																	<div className="text-sm text-text-secondary">
																		{instance.domain}
																	</div>
																</div>
															</div>
														</td>
														<td className="px-6 py-4 whitespace-nowrap">
															<div className="text-sm text-text-primary">
																{instance.software || 'Unknown'}
															</div>
															{instance.version && (
																<div className="text-sm text-text-secondary">
																	v{instance.version}
																</div>
															)}
														</td>
														<td className="px-6 py-4 whitespace-nowrap">
															<div className="text-sm text-text-primary">
																{instance.userCount?.toLocaleString() ||
																	'N/A'}
															</div>
															{instance.eventCount !== undefined && (
																<div className="text-sm text-text-secondary">
																	{instance.eventCount.toLocaleString()}{' '}
																	posts
																</div>
															)}
														</td>
														<td className="px-6 py-4 whitespace-nowrap">
															<div className="text-sm text-text-primary">
																{instance.stats?.remoteUsers || 0}{' '}
																cached users
															</div>
															<div className="text-sm text-text-secondary">
																{instance.stats?.remoteEvents || 0}{' '}
																events,{' '}
																{instance.stats?.localFollowing ||
																	0}{' '}
																following
															</div>
														</td>
														<td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
															{instance.lastActivityAt
																? new Date(
																		instance.lastActivityAt
																	).toLocaleDateString()
																: 'Never'}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									) : (
										<div className="text-center py-12 px-6">
											<GlobeIcon className="mx-auto h-12 w-12 text-text-tertiary" />
											<h3 className="mt-2 text-sm font-medium text-text-primary">
												No instances discovered yet
											</h3>
											<p className="mt-1 text-sm text-text-secondary">
												Instances will appear here automatically when remote
												users interact with your instance.
											</p>
										</div>
									)}
								</div>
							</>
						)}
					</div>
				)}

				{/* Reports Tab */}
				{activeTab === 'reports' && (
					<div>
						<div className="flex justify-between items-center mb-4">
							<h2 className="text-xl font-semibold text-text-primary">
								Content Moderation
							</h2>
						</div>
						<ReportQueue />
					</div>
				)}

				{/* Appeals Tab */}
				{activeTab === 'appeals' && (
					<div>
						<div className="flex justify-between items-center mb-4">
							<h2 className="text-xl font-semibold text-text-primary">
								Appeal Requests
							</h2>
						</div>
						<AppealQueue />
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
						error={
							createApiKeyMutation.error instanceof Error
								? createApiKeyMutation.error.message
								: typeof createApiKeyMutation.error === 'object' &&
									  createApiKeyMutation.error !== null &&
									  'message' in createApiKeyMutation.error
									? String(createApiKeyMutation.error.message)
									: undefined
						}
						users={usersData?.users || []}
					/>
				)}

				{/* New API Key Display Modal */}
				{newApiKey && (
					<Modal
						isOpen={Boolean(newApiKey)}
						onClose={() => setNewApiKey(null)}
						maxWidth="md">
						<div className="p-6">
							<h3 className="text-lg font-semibold mb-4">API Key Created</h3>
							<p className="text-sm text-neutral-600 mb-4">
								Save this key now. You will not be able to see it again.
							</p>
							<div
								id="api-key-display"
								className="bg-background-secondary p-4 rounded font-mono text-sm break-all mb-4 select-all cursor-text text-text-primary"
								onClick={(e) => {
									// Select all text when clicking on the key
									const range = document.createRange()
									range.selectNodeContents(e.currentTarget)
									const selection = window.getSelection()
									selection?.removeAllRanges()
									selection?.addRange(range)
								}}>
								{newApiKey}
							</div>
							<Button
								onClick={async () => {
									try {
										// navigator.clipboard is always defined in TypeScript's DOM types
										if (
											'clipboard' in navigator &&
											navigator.clipboard.writeText
										) {
											await navigator.clipboard.writeText(newApiKey)
											addToast({
												id: generateId(),
												message: 'Copied to clipboard!',
												variant: 'success',
											})
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
												addToast({
													id: generateId(),
													message: 'Copied to clipboard!',
													variant: 'success',
												})
											} catch (err) {
												logger.error('Failed to copy to clipboard:', err)
												// Fallback: select the text so user can manually copy
												textarea.style.position = 'static'
												textarea.style.opacity = '1'
												textarea.focus()
												textarea.select()
												handleError(
													new Error(
														'Please manually copy the text above'
													),
													'Copy failed',
													{ context: 'AdminPage.copyApiKey' }
												)
											}
											document.body.removeChild(textarea)
										}
									} catch (err) {
										logger.error('Failed to copy:', err)
										// Fallback: select the text in the display div
										const keyDiv = document.getElementById('api-key-display')
										if (keyDiv) {
											const range = document.createRange()
											range.selectNodeContents(keyDiv)
											const selection = window.getSelection()
											selection?.removeAllRanges()
											selection?.addRange(range)
											addToast({
												id: generateId(),
												message:
													'Text selected - press Ctrl+C (or Cmd+C) to copy',
												variant: 'success',
											})
										} else {
											handleError(
												new Error(
													'Failed to copy. Please manually select and copy the key above.'
												),
												'Copy failed',
												{ context: 'AdminPage.copyApiKey' }
											)
										}
									}
								}}
								variant="secondary"
								fullWidth
								className="mb-2">
								Copy to Clipboard
							</Button>
							<Button onClick={() => setNewApiKey(null)} variant="primary" fullWidth>
								I&apos;ve Saved It
							</Button>
						</div>
					</Modal>
				)}

				{/* Delete User Confirmation */}
				<ConfirmationModal
					isOpen={deleteUserId !== null}
					title="Delete User"
					message="Are you sure you want to delete this user?"
					confirmLabel="Delete"
					cancelLabel="Cancel"
					variant="danger"
					onConfirm={() => {
						if (deleteUserId) {
							deleteUserMutation.mutate(deleteUserId)
							setDeleteUserId(null)
						}
					}}
					onCancel={() => setDeleteUserId(null)}
					isPending={deleteUserMutation.isPending}
				/>

				{/* Revoke API Key Confirmation */}
				<ConfirmationModal
					isOpen={revokeApiKeyId !== null}
					title="Revoke API Key"
					message="Are you sure you want to revoke this API key?"
					confirmLabel="Revoke"
					cancelLabel="Cancel"
					variant="danger"
					onConfirm={() => {
						if (revokeApiKeyId) {
							deleteApiKeyMutation.mutate(revokeApiKeyId)
							setRevokeApiKeyId(null)
						}
					}}
					onCancel={() => setRevokeApiKeyId(null)}
					isPending={deleteApiKeyMutation.isPending}
				/>
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

	const handleSubmit = (e: FormEvent) => {
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
		<Modal isOpen={true} onClose={onClose} maxWidth="md">
			<div className="p-6">
				<h3 className="text-lg font-semibold mb-4">Create User</h3>
				{error && <div className="mb-4 text-sm text-error-600">{error}</div>}
				<form onSubmit={handleSubmit}>
					<div className="mb-4">
						<Input
							type="text"
							label="Username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							required
						/>
					</div>
					<div className="mb-4">
						<Input
							type="email"
							label="Email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
					</div>
					<div className="mb-4">
						<Input
							type="text"
							label="Name"
							value={name}
							onChange={(e) => setName(e.target.value)}
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
							<span className="text-sm text-text-secondary">Bot User</span>
						</label>
					</div>
					{!isBot && (
						<div className="mb-4">
							<Input
								type="password"
								label="Password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								minLength={8}
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
							<span className="text-sm text-text-secondary">Admin</span>
						</label>
					</div>
					<div className="flex gap-2">
						<Button
							type="button"
							variant="secondary"
							onClick={onClose}
							fullWidth
							disabled={isPending}>
							Cancel
						</Button>
						<Button
							type="submit"
							variant="primary"
							fullWidth
							disabled={isPending}
							loading={isPending}>
							{isPending ? 'Creating...' : 'Create'}
						</Button>
					</div>
				</form>
			</div>
		</Modal>
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

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault()
		onCreate({
			userId,
			name,
			description: description || undefined,
		})
	}

	return (
		<Modal isOpen={true} onClose={onClose} maxWidth="md">
			<div className="p-6">
				<h3 className="text-lg font-semibold mb-4">Create API Key</h3>
				{error && <div className="mb-4 text-sm text-error-600">{error}</div>}
				<form onSubmit={handleSubmit}>
					<div className="mb-4">
						<label className="block text-sm font-medium text-text-secondary mb-1">
							User *
						</label>
						<select
							value={userId}
							onChange={(e) => setUserId(e.target.value)}
							required
							className="w-full px-3 py-2 border border-border-default rounded-md bg-background-primary text-text-primary">
							<option value="">Select a user</option>
							{users.map((userOption) => (
								<option key={userOption.id} value={userOption.id}>
									{userOption.username} {userOption.isBot && '(Bot)'}
								</option>
							))}
						</select>
					</div>
					<div className="mb-4">
						<Input
							type="text"
							label="Name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
						/>
					</div>
					<div className="mb-4">
						<Textarea
							label="Description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							rows={3}
						/>
					</div>
					<div className="flex gap-2">
						<Button
							type="button"
							variant="secondary"
							onClick={onClose}
							fullWidth
							disabled={isPending}>
							Cancel
						</Button>
						<Button
							type="submit"
							variant="primary"
							fullWidth
							disabled={isPending}
							loading={isPending}>
							{isPending ? 'Creating...' : 'Create'}
						</Button>
					</div>
				</form>
			</div>
		</Modal>
	)
}
