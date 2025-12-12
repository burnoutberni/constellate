import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Input, Button } from '@/components/ui'
import { extractErrorMessage } from '@/lib/errorHandling'
import { createLogger } from '@/lib/logger'

const log = createLogger('[LoginPage]')

export function LoginPage() {
    const [isLogin, setIsLogin] = useState(true)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [username, setUsername] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { login, signup } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            if (isLogin) {
                await login(email, password)
            } else {
                await signup(email, password, name, username)
            }
            navigate('/feed')
        } catch (err: unknown) {
            const errorMessage = extractErrorMessage(err, 'Authentication failed. Please check your credentials.')
            setError(errorMessage)
            log.error('Authentication error:', err)
        } finally {
            setLoading(false)
        }
    }

    const submitText = isLogin ? 'Sign In' : 'Sign Up'

    return (
        <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
            <div className="card w-full max-w-md p-8 bg-white shadow-xl rounded-xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-info-600 mb-2">Constellate</h1>
                    <p className="text-neutral-600">
                        {isLogin ? 'Sign in to manage your events' : 'Create an account'}
                    </p>
                </div>

                {error && (
                    <div className="bg-error-50 text-error-600 p-3 rounded-lg mb-6 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <>
                            <Input
                                type="text"
                                label="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="alice"
                                pattern="^[a-zA-Z0-9_\-]+$"
                                title="Username can only contain letters, numbers, underscores, and hyphens"
                                required={!isLogin}
                            />
                            <Input
                                type="text"
                                label="Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Alice Smith"
                                required={!isLogin}
                            />
                        </>
                    )}

                    <Input
                        type="email"
                        label="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="alice@example.com"
                        required
                    />

                    <Input
                        type="password"
                        label="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={8}
                    />

                    <Button
                        type="submit"
                        disabled={loading}
                        loading={loading}
                        fullWidth
                        size="lg"
                    >
                        {submitText}
                    </Button>
                </form>

                <div className="mt-6 text-center text-sm text-neutral-500">
                    <p>
                        {isLogin ? "Don't have an account? " : 'Already have an account? '}
                        <Button
                            onClick={() => setIsLogin(!isLogin)}
                            variant="ghost"
                            size="sm"
                            className="text-info-600 hover:underline h-auto p-0"
                        >
                            {isLogin ? 'Sign up' : 'Sign in'}
                        </Button>
                    </p>
                </div>
            </div>
        </div>
    )
}
