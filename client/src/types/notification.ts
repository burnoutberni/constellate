export type NotificationType = 'FOLLOW' | 'COMMENT' | 'LIKE' | 'MENTION' | 'EVENT' | 'SYSTEM'

export interface NotificationActor {
	id: string
	username?: string | null
	name?: string | null
	displayColor?: string | null
	profileImage?: string | null
}

export interface Notification {
	id: string
	type: NotificationType
	title: string
	body?: string | null
	contextUrl?: string | null
	data?: Record<string, unknown> | null
	read: boolean
	readAt?: string | null
	createdAt: string
	updatedAt: string
	actor: NotificationActor | null
}
