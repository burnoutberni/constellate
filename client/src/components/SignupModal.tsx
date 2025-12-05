import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface SignupModalProps {
    isOpen: boolean
    onClose: () => void
    action?: 'rsvp' | 'like' | 'comment'
    onSuccess?: () => void
}

export function SignupModal({ isOpen, onClose, action, onSuccess }: SignupModalProps) {
    const [isLogin, setIsLogin] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [username, setUsername] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { login, signup } = useAuth()
    const submitLabel = isLogin ? 'Sign In' : 'Create Account'

    if (!isOpen) return null

    const getActionText = () => {
        switch (action) {
            case 'rsvp':
                return 'RSVP to this event'
            case 'like':
                return 'like this event'
            case 'comment':
                return 'leave a comment'
            default:
                return 'continue'
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            if (isLogin) {
                await login(email, password)
            } else {
                await signup(email, password, name, username)
            }
            // Close modal and trigger success callback
            onClose()
            onSuccess?.()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Authentication failed. Please check your credentials.')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const loadingLabel = isLogin ? 'Signing in...' : 'Creating account...'

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="card w-full max-w-md p-8 bg-white shadow-2xl rounded-xl animate-slide-up max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="text-5xl mb-3">✨</div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {isLogin ? 'Welcome back!' : 'Join Constellate'}
                    </h2>
                    <p className="text-gray-600">
                        {isLogin
                            ? 'Sign in to continue'
                            : `Sign up to ${getActionText()}`}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm border border-red-200">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Username *
                                </label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="input w-full"
                                    placeholder="alice"
                                    pattern="^[a-zA-Z0-9_\-]+$"
                                    title="Username can only contain letters, numbers, underscores, and hyphens"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Name *
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="input w-full"
                                    placeholder="Alice Smith"
                                    required
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email *
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input w-full"
                            placeholder="alice@example.com"
                            required
                            autoFocus={isLogin}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Password *
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input w-full"
                            placeholder="••••••••"
                            required
                            minLength={8}
                        />
                        {!isLogin && (
                            <p className="text-xs text-gray-500 mt-1">
                                Must be at least 8 characters
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary w-full py-3 text-lg font-semibold"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                {loadingLabel}
                            </span>
                        ) : (
                            submitLabel
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => {
                            setIsLogin(!isLogin)
                            setError('')
                        }}
                        className="text-sm text-blue-600 hover:underline focus:outline-none"
                    >
                        {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                    </button>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="w-full text-sm text-gray-500 hover:text-gray-700 focus:outline-none"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
}

