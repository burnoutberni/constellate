import { z } from 'zod'

// Standard offset-based pagination
export const PaginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
})

// Cursor-based pagination (often used for feeds)
export const CursorPaginationSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(20),
	cursor: z.string().optional(),
})

// Helper to calculate skip for offset-based pagination
export function getSkip(page: number, limit: number): number {
	return (page - 1) * limit
}

// Helper to format pagination response
export function formatPaginationResponse<T>(
	items: T[],
	total: number,
	page: number,
	limit: number
) {
	return {
		items, // Or whatever key needs to be used, but usually it's spread into the response
		pagination: {
			page,
			limit,
			total,
			pages: Math.ceil(total / limit),
		},
	}
}
