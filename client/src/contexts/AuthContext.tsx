import { createContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { authClient } from '../lib/auth-client'
import { logger } from '@/lib/logger'

interface User {
    id: string
    email: string
    name?: string
    username?: string
    image?: string | null
}

interface AuthContextType {
    user: User | null
    loading: boolean
    login: (email: string, password: string) => Promise<void>
    sendMagicLink: (email: string) => Promise<void>
    signup: (email: string, password: string, name: string, username: string) => Promise<void>
    logout: () => Promise<void>
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    const checkAuth = useCallback(async () => {
        try {
            const { data: session } = await authClient.getSession()
            setUser(session?.user || null)
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

    const sendMagicLink = async (email: string) => {
        const { error } = await authClient.signIn.magicLink({
            email,
            callbackURL: window.location.origin,
        })

        if (error) {
            throw error
        }
    }

    const signup = async (email: string, password: string, name: string, username: string) => {
        const { data, error } = await authClient.signUp.email({
            email,
            password,
            name,
            username,
        } as unknown as Parameters<typeof authClient.signUp.email>[0])

        if (error) {
            throw error
        }

        if (data) {
            await checkAuth()
        }
    }

    const logout = async () => {
        await authClient.signOut()
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, sendMagicLink, signup, logout }}>
            {children}
        </AuthContext.Provider>
    )
}
