export type ReportCategory = 'spam' | 'harassment' | 'inappropriate' | 'other'

export type ReportStatus = 'pending' | 'resolved' | 'dismissed'

export interface Report {
	id: string
	createdAt: string
	updatedAt: string
	reporterId: string
	reporter?: {
		id: string
		username: string
		name?: string | null
	}
	reportedUserId?: string | null
	contentUrl?: string | null
	contentPath?: string | null
	reason: string
	category: ReportCategory
	status: ReportStatus
}

