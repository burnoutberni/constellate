import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { Button, Spinner, Badge, Card, CardContent } from '@/components/ui'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/formatUtils'
import { generateId } from '@/lib/utils'
import { useUIStore } from '@/stores'

interface Appeal {
	id: string
	type: 'CONTENT_REMOVAL' | 'ACCOUNT_SUSPENSION'
	reason: string
	status: 'PENDING' | 'APPROVED' | 'REJECTED'
	createdAt: string
	user: {
		username: string
	}
}

const APPEAL_TYPE_LABELS: Record<Appeal['type'], string> = {
	CONTENT_REMOVAL: 'Content Removal',
	ACCOUNT_SUSPENSION: 'Account Suspension',
}

export function AppealQueue() {
	const queryClient = useQueryClient()
	const handleError = useErrorHandler()
	const addToast = useUIStore((state) => state.addToast)

	const { data, isLoading } = useQuery<{ appeals: Appeal[] }>({
		queryKey: ['admin', 'appeals'],
		queryFn: () => api.get('/admin/appeals?status=pending'),
	})

	const updateStatusMutation = useMutation({
		mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
			return api.put(`/admin/appeals/${id}`, { status })
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['admin', 'appeals'] })
			addToast({
				id: generateId(),
				message: 'Appeal updated successfully',
				variant: 'success',
			})
		},
		onError: (error) => {
			handleError(error, 'Failed to update appeal', { context: 'AppealQueue.updateStatus' })
		},
	})

	if (isLoading) {
		return (
			<div className="flex justify-center py-12">
				<Spinner size="lg" />
			</div>
		)
	}

	if (!data?.appeals.length) {
		return (
			<div className="text-center py-12 text-text-secondary bg-background-primary rounded-lg border border-border-default">
				No pending appeals.
			</div>
		)
	}

	return (
		<div className="space-y-4">
			{data.appeals.map((appeal) => (
				<Card key={appeal.id}>
					<CardContent className="p-4">
						<div className="flex justify-between items-start gap-4">
							<div className="flex-1">
								<div className="flex items-center gap-2 mb-2">
									<Badge variant="secondary">
										{APPEAL_TYPE_LABELS[appeal.type]}
									</Badge>
									<span className="text-sm text-text-secondary">
										Appealed by @{appeal.user.username}
									</span>
									<span className="text-sm text-text-tertiary">
										• {formatDate(appeal.createdAt)}
									</span>
								</div>
								<p className="text-text-primary">{appeal.reason}</p>
							</div>

							<div className="flex gap-2">
								<Button
									size="sm"
									variant="ghost"
									className="text-error-600 hover:text-error-700 hover:bg-error-50"
									loading={updateStatusMutation.isPending}
									onClick={() =>
										updateStatusMutation.mutate({
											id: appeal.id,
											status: 'rejected',
										})
									}>
									Reject
								</Button>
								<Button
									size="sm"
									variant="primary"
									loading={updateStatusMutation.isPending}
									onClick={() =>
										updateStatusMutation.mutate({
											id: appeal.id,
											status: 'approved',
										})
									}>
									Approve
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	)
}
