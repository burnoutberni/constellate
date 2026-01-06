import { z } from 'zod'

// Standard offset-based pagination
// Helper for lenient limit validation
const lenientLimit = z.coerce
	.number()
	.catch(20) // Default to 20 if NaN/invalid
	.pipe(
		z.number().transform((val) => {
			// Clamp values outside range
			if (val < 1) return 20 // Default legacy behavior was often fallback to default
			if (val > 100) return 100
			return val
		})
	)

// Helper for lenient page validation
const lenientPage = z.coerce.number().catch(1).pipe(z.number().min(1).catch(1))

// Standard offset-based pagination
export const PaginationSchema = z.object({
	page: lenientPage.default(1),
	limit: lenientLimit.default(20),
})

// Cursor-based pagination (often used for feeds)
export const CursorPaginationSchema = z.object({
	limit: lenientLimit.default(20),
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
	limit: number,
	key = 'items'
) {
	return {
		[key]: items,
		pagination: {
			page,
			limit,
			total,
			pages: Math.ceil(total / limit),
		},
	}
}
