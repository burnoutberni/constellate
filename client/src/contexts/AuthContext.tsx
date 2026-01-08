import { createContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'

import { logger } from '@/lib/logger'

import { api } from '../lib/api-client'
import { authClient } from '../lib/auth-client'
import { getErrorStatus } from '../lib/errorHandling'

interface User {
	id: string
	email: string
	name?: string
	username?: string | null
	image?: string | null
	isRemote: boolean
}

interface TosStatus {
	accepted: boolean
	acceptedAt: string | null
	acceptedVersion: number | null
	currentVersion: number
	needsAcceptance: boolean
}

interface AuthContextType {
	user: User | null
	loading: boolean
	tosStatus: TosStatus | null
	checkTosStatus: () => Promise<void>
	login: (email: string, password: string) => Promise<void>
	signup: (
		email: string,
		password: string,
		name: string,
		username: string,
		tosAccepted: boolean
	) => Promise<void>
	logout: () => Promise<void>
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null)
	const [loading, setLoading] = useState(true)
	const [tosStatus, setTosStatus] = useState<TosStatus | null>(null)
	const userRef = useRef<User | null>(null)

	// Keep ref in sync with state
	useEffect(() => {
		userRef.current = user
	}, [user])

	const checkTosStatus = useCallback(async () => {
		// Read current user from ref to avoid dependency issues
		const currentUser = userRef.current
		if (!currentUser) {
			setTosStatus(null)
			return
		}

		try {
			const status = await api.get<TosStatus>('/tos/status')
			setTosStatus(status)
		} catch (error) {
			// If we get 401, user is not authenticated - that's fine
			if (getErrorStatus(error) === 401) {
				setTosStatus(null)
			} else {
				logger.error('Failed to check ToS status:', error)
				// Don't block the app if we can't check ToS status
				setTosStatus(null)
			}
		}
	}, [])

	const checkAuth = useCallback(async () => {
		try {
			const { data: session } = await authClient.getSession()
			const sessionUser = session?.user
			const authenticatedUser: User | null = sessionUser ? {
				id: sessionUser.id,
				email: sessionUser.email,
				name: sessionUser.name,
				username: (sessionUser as { username?: string | null }).username, // Ideally auth-client returns this, but if not we assume it is there or extend type
				image: sessionUser.image,
				isRemote: (sessionUser as { isRemote?: boolean }).isRemote || false,
			} : null

			// Verify key fields
			if (authenticatedUser && !authenticatedUser.id) {
				throw new Error('User session missing ID')
			}

			setUser(authenticatedUser)
		} catch (error) {
			logger.error('Auth check failed:', error)
			setUser(null)
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		checkAuth()
	}, [checkAuth])

	// Check ToS status when user changes
	useEffect(() => {
		checkTosStatus()
	}, [user, checkTosStatus])

	const login = async (email: string, password: string) => {
		const { data, error } = await authClient.signIn.email({
			email,
			password,
		})

		if (error) {
			throw error
		}

		if (data) {
			await checkAuth()
		}
	}

	const signup = async (
		email: string,
		password: string,
		name: string,
		username: string,
		tosAccepted: boolean
	) => {
		type SignUpParams = Parameters<typeof authClient.signUp.email>[0]
		const signupData: SignUpParams & { tosAccepted: boolean } = {
			email,
			password,
			name,
			username,
			tosAccepted,
		}
		const { error } = await authClient.signUp.email(signupData)

		if (error) {
			throw error
		}

		await checkAuth()
	}

	const logout = async () => {
		await authClient.signOut()
		setUser(null)
		setTosStatus(null)
	}

	return (
		<AuthContext.Provider
			value={{
				user,
				loading,
				tosStatus,
				checkTosStatus,
				login,
				signup,
				logout,
			}}>
			{children}
		</AuthContext.Provider>
	)
}
