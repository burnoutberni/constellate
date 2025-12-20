import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button, Spinner, Badge, Card, CardContent } from '@/components/ui'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { api } from '@/lib/api-client'
import { generateId } from '@/lib/utils'
import { useUIStore } from '@/stores'
import { Report } from '@/types'

const REPORT_CATEGORY_LABELS: Record<Report['category'], string> = {
	spam: 'Spam',
	harassment: 'Harassment',
	inappropriate: 'Inappropriate',
	other: 'Other',
}

export function ReportQueue() {
	const queryClient = useQueryClient()
	const handleError = useErrorHandler()
	const addToast = useUIStore((state) => state.addToast)
	const [resolvingId, setResolvingId] = useState<string | null>(null)

	async function handleViewContent(report: Report) {
		setResolvingId(report.id)
		if (report.contentPath) {
			window.open(report.contentPath, '_blank')
		} else {
			addToast({
				id: generateId(),
				message:
					'Resolution unavailable. The reported content may have been deleted or the target cannot be resolved.',
				variant: 'error',
			})
		}
		setResolvingId(null)
	}

	const { data, isLoading } = useQuery<{ reports: Report[] }>({
		queryKey: ['admin', 'reports'],
		queryFn: () => api.get('/reports?status=pending'),
	})

	const updateStatusMutation = useMutation({
		mutationFn: async ({ id, status }: { id: string; status: 'resolved' | 'dismissed' }) => {
			return api.put(`/reports/${id}`, { status })
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] })
			addToast({
				id: generateId(),
				message: 'Report updated successfully',
				variant: 'success',
			})
		},
		onError: (error) => {
			handleError(error, 'Failed to update report', { context: 'ReportQueue.updateStatus' })
		},
	})

	if (isLoading) {
		return (
			<div className="flex justify-center py-12">
				<Spinner size="lg" />
			</div>
		)
	}

	if (!data?.reports.length) {
		return (
			<div className="text-center py-12 text-text-secondary bg-background-primary rounded-lg border border-border-default">
				No pending reports. Good job! 🎉
			</div>
		)
	}

	return (
		<div className="space-y-4">
			{data.reports.map((report) => (
				<Card key={report.id}>
					<CardContent className="p-4">
						<div className="flex justify-between items-start gap-4">
							<div className="flex-1">
								<div className="flex items-center gap-2 mb-2">
									<Badge variant="warning">{REPORT_CATEGORY_LABELS[report.category]}</Badge>
									<span className="text-sm text-text-secondary">
										Reported by @{report.reporter?.username || 'Unknown'}
									</span>
									<span className="text-sm text-text-tertiary">
										• {new Date(report.createdAt).toLocaleDateString()}
									</span>
								</div>
								
								<p className="text-text-primary mb-3">{report.reason}</p>
								
								<div className="bg-background-secondary p-2 rounded text-sm font-mono text-text-secondary mb-3">
									Target: {report.contentUrl}
								</div>
							</div>

							<div className="flex flex-col gap-2">
								<Button
									size="sm"
									variant="secondary"
									loading={resolvingId === report.id}
									onClick={() => handleViewContent(report)}
									aria-label="View reported content">
									View Content
								</Button>
								<div className="flex gap-2">
									<Button
										size="sm"
										variant="ghost"
										className="text-error-600 hover:text-error-700 hover:bg-error-50"
										loading={updateStatusMutation.isPending}
										onClick={() =>
											updateStatusMutation.mutate({ id: report.id, status: 'dismissed' })
										}>
										Dismiss
									</Button>
									<Button
										size="sm"
										variant="primary"
										loading={updateStatusMutation.isPending}
										onClick={() =>
											updateStatusMutation.mutate({ id: report.id, status: 'resolved' })
										}>
										Resolve
									</Button>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	)
}
