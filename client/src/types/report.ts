export type ReportCategory = 'spam' | 'harassment' | 'inappropriate' | 'other'

export type ReportStatus = 'pending' | 'resolved' | 'dismissed'

export interface Report {
	id: string
	createdAt: string
	updatedAt: string
	reporterId: string
	reportedUserId?: string | null
	contentUrl?: string | null
	reason: string
	category: ReportCategory
	status: ReportStatus
}
