/**
 * Appeal Constants
 * Shared constants for appeal types matching the Prisma AppealType enum
 */

export const APPEAL_TYPE = {
	ACCOUNT_SUSPENSION: 'ACCOUNT_SUSPENSION',
	CONTENT_REMOVAL: 'CONTENT_REMOVAL',
} as const

export type AppealType = (typeof APPEAL_TYPE)[keyof typeof APPEAL_TYPE]

/**
 * Human-readable labels for appeal types
 */
export const APPEAL_TYPE_LABELS: Record<AppealType, string> = {
	[APPEAL_TYPE.ACCOUNT_SUSPENSION]: 'Account Suspension',
	[APPEAL_TYPE.CONTENT_REMOVAL]: 'Content Removal',
}
