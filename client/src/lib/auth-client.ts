import type { auth } from '@server/auth.js'
import { inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
	baseURL: typeof window !== 'undefined' ? `${window.location.origin}/api/auth` : '/api/auth',
	plugins: [inferAdditionalFields<typeof auth>()],
})
