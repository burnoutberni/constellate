import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { Container, Stack } from '@/components/layout'
import { Navbar } from '@/components/Navbar'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Spinner } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api-client'

interface Appeal {
	id: string
	type: string
	reason: string
	status: 'PENDING' | 'APPROVED' | 'REJECTED'
	createdAt: string
	resolvedAt?: string
	adminNotes?: string
}

export function AppealsPage() {
	const { user, logout } = useAuth()

	const { data, isLoading } = useQuery<{ appeals: Appeal[] }>({
		queryKey: ['appeals'],
		queryFn: () => api.get('/appeals'),
	})

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'APPROVED':
				return 'success'
			case 'REJECTED':
				return 'error'
			default:
				return 'warning'
		}
	}

	return (
		<div className="min-h-screen bg-background-secondary">
			<Navbar isConnected={false} user={user} onLogout={logout} />
			<Container className="py-8" size="md">
				<div className="flex justify-between items-center mb-6">
					<div>
						<h1 className="text-3xl font-bold text-text-primary">My Appeals</h1>
						<p className="text-text-secondary mt-1">
							Track the status of your moderation appeals
						</p>
					</div>
					<Link to="/settings">
						<Button variant="ghost">Back to Settings</Button>
					</Link>
				</div>

				{isLoading ? (
					<div className="flex justify-center py-12">
						<Spinner size="lg" />
					</div>
				) : (
					<Stack gap="md">
						{data?.appeals.length === 0 ? (
							<Card>
								<CardContent className="py-12 text-center text-text-secondary">
									You haven&apos;t submitted any appeals yet.
								</CardContent>
							</Card>
						) : (
							data?.appeals.map((appeal) => (
								<Card key={appeal.id}>
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
										<CardTitle className="text-lg font-medium">
											{appeal.type.replace('_', ' ')}
										</CardTitle>
										<Badge variant={getStatusColor(appeal.status)}>
											{appeal.status}
										</Badge>
									</CardHeader>
									<CardContent>
										<div className="space-y-4">
											<div>
												<p className="text-sm font-medium text-text-secondary">
													Reason
												</p>
												<p className="text-text-primary mt-1">{appeal.reason}</p>
											</div>
											<div className="text-sm text-text-tertiary">
												Submitted on{' '}
												{new Date(appeal.createdAt).toLocaleDateString()}
											</div>
											{appeal.resolvedAt && (
												<div className="pt-4 border-t border-border-default">
													<p className="text-sm font-medium text-text-secondary">
														Resolution
													</p>
													<p className="text-text-primary mt-1">
														{appeal.adminNotes || 'No additional notes provided.'}
													</p>
													<p className="text-xs text-text-tertiary mt-1">
														Resolved on{' '}
														{new Date(appeal.resolvedAt).toLocaleDateString()}
													</p>
												</div>
											)}
										</div>
									</CardContent>
								</Card>
							))
						)}
					</Stack>
				)}
			</Container>
		</div>
	)
}
