import { createContext, useContext, useEffect, useState } from 'react'
import { authClient } from '../lib/auth-client'

interface User {
    id: string
    email: string
    name?: string
    image?: string | null
}

interface AuthContextType {
    user: User | null
    loading: boolean
    login: (email: string, password: string) => Promise<void>
    signup: (email: string, password: string, name: string, username: string) => Promise<void>
    logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        checkAuth()
    }, [])

    const checkAuth = async () => {
        try {
            const { data: session } = await authClient.getSession()
            setUser(session?.user || null)
        } catch (error) {
            console.error('Auth check failed:', error)
            setUser(null)
        } finally {
            setLoading(false)
        }
    }

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

    const signup = async (email: string, password: string, name: string, username: string) => {
        const { data, error } = await authClient.signUp.email({
            email,
            password,
            name,
            username,
        } as any)

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
        <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
