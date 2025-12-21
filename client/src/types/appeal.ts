import { type AppealType } from '@/lib/appealConstants'

export interface Appeal {
	id: string
	type: AppealType
	reason: string
	status: 'PENDING' | 'APPROVED' | 'REJECTED'
	createdAt: string
	resolvedAt?: string
	adminNotes?: string
}

