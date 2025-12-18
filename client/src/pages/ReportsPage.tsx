import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { AppealModal } from '@/components/AppealModal'
import { Container, Stack } from '@/components/layout'
import { Navbar } from '@/components/Navbar'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Spinner } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api-client'
import { type Report } from '@/types'

const REPORT_CATEGORY_LABELS: Record<Report['category'], string> = {
	spam: 'Spam',
	harassment: 'Harassment or Bullying',
	inappropriate: 'Inappropriate Content',
	other: 'Other',
}

export function ReportsPage() {
	const { user, logout } = useAuth()
	const queryClient = useQueryClient()
	const [appealModalState, setAppealModalState] = useState<{
		isOpen: boolean
		reportId?: string
	}>({ isOpen: false })

	const { data, isLoading } = useQuery<{ reports: Report[] }>({
		queryKey: ['reports', 'me'],
		queryFn: () => api.get('/reports/me'),
	})

	const handleAppealSuccess = () => {
		queryClient.invalidateQueries({ queryKey: ['reports', 'me'] })
		setAppealModalState({ isOpen: false })
	}

	const getStatusColor = (status: Report['status']) => {
		switch (status) {
			case 'resolved':
				return 'success'
			case 'dismissed':
				return 'error'
			default:
				return 'warning'
		}
	}

	const getStatusLabel = (status: Report['status']) => {
		switch (status) {
			case 'resolved':
				return 'Resolved'
			case 'dismissed':
				return 'Dismissed'
			default:
				return 'Pending Review'
		}
	}

	const parseContentUrl = (contentUrl?: string | null) => {
		if (!contentUrl) {
			return null
		}
		const [targetType, targetId] = contentUrl.split(':')
		return { targetType, targetId }
	}

	return (
		<div className="min-h-screen bg-background-secondary">
			<Navbar isConnected={false} user={user} onLogout={logout} />
			<Container className="py-8" size="md">
				<div className="flex justify-between items-center mb-6">
					<div>
						<h1 className="text-3xl font-bold text-text-primary">My Reports</h1>
						<p className="text-text-secondary mt-1">
							View the status of your content reports
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
						{data?.reports.length === 0 ? (
							<Card>
								<CardContent className="py-12 text-center text-text-secondary">
									You haven&apos;t submitted any reports yet.
								</CardContent>
							</Card>
						) : (
							data?.reports.map((report) => {
								const contentInfo = parseContentUrl(report.contentUrl)
								return (
									<Card key={report.id}>
										<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
											<CardTitle className="text-lg font-medium">
												Report #{report.id.slice(-8)}
											</CardTitle>
											<Badge variant={getStatusColor(report.status)}>
												{getStatusLabel(report.status)}
											</Badge>
										</CardHeader>
										<CardContent>
											<div className="space-y-4">
												<div>
													<p className="text-sm font-medium text-text-secondary">
														Category
													</p>
													<p className="text-text-primary mt-1">
														{REPORT_CATEGORY_LABELS[report.category]}
													</p>
												</div>
												{contentInfo && (
													<div>
														<p className="text-sm font-medium text-text-secondary">
															Reported Content
														</p>
														<p className="text-text-primary mt-1 capitalize">
															{contentInfo.targetType}:{' '}
															{contentInfo.targetId.slice(-8)}
														</p>
													</div>
												)}
												<div>
													<p className="text-sm font-medium text-text-secondary">
														Reason
													</p>
													<p className="text-text-primary mt-1">
														{report.reason}
													</p>
												</div>
												<div className="text-sm text-text-tertiary">
													Submitted on{' '}
													{new Date(
														report.createdAt
													).toLocaleDateString()}
												</div>
												{(report.status === 'resolved' ||
													report.status === 'dismissed') && (
													<div className="pt-4 border-t border-border-default">
														<p className="text-sm font-medium text-text-secondary mb-2">
															{report.status === 'resolved'
																? 'This report has been resolved by our moderation team.'
																: 'This report has been dismissed by our moderation team.'}
														</p>
														<Button
															variant="outline"
															size="sm"
															onClick={() =>
																setAppealModalState({
																	isOpen: true,
																	reportId: report.id,
																})
															}>
															Appeal This Decision
														</Button>
													</div>
												)}
											</div>
										</CardContent>
									</Card>
								)
							})
						)}
					</Stack>
				)}

				<AppealModal
					isOpen={appealModalState.isOpen}
					onClose={() => setAppealModalState({ isOpen: false })}
					onSuccess={handleAppealSuccess}
					referenceId={appealModalState.reportId}
					referenceType="report"
				/>
			</Container>
		</div>
	)
}
