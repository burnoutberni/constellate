import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { Input, Button, Card, CardContent } from '@/components/ui'
import { extractErrorMessage } from '@/lib/errorHandling'
import { createLogger } from '@/lib/logger'

import { useAuth } from '../hooks/useAuth'

const log = createLogger('[LoginPage]')

export function LoginPage() {
	const [isLogin, setIsLogin] = useState(true)
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [name, setName] = useState('')
	const [username, setUsername] = useState('')
	const [tosAccepted, setTosAccepted] = useState(false)
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)
	const { login, signup } = useAuth()
	const navigate = useNavigate()

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault()
		setError('')

		if (!isLogin && !tosAccepted) {
			setError('You must agree to the Terms of Service and Privacy Policy to continue.')
			return
		}

		setLoading(true)

		try {
			if (isLogin) {
				await login(email, password)
			} else {
				await signup(email, password, name, username, tosAccepted)
			}
			navigate('/feed')
		} catch (err: unknown) {
			const errorMessage = extractErrorMessage(
				err,
				'Authentication failed. Please check your credentials.'
			)
			setError(errorMessage)
			log.error('Authentication error:', err)
		} finally {
			setLoading(false)
		}
	}

	const submitText = isLogin ? 'Sign In' : 'Sign Up'

	return (
		<div className="min-h-screen bg-background-secondary flex items-center justify-center p-4">
			<Card className="w-full max-w-md shadow-xl">
				<CardContent className="p-8">
					<div className="text-center mb-8">
						<h1 className="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-2">
							Constellate
						</h1>
						<p className="text-text-secondary">
							{isLogin ? 'Sign in to manage your events' : 'Create an account'}
						</p>
					</div>

					{error && (
						<div className="bg-error-50 dark:bg-error-900/20 text-error-600 dark:text-error-400 p-3 rounded-lg mb-6 text-sm border border-error-200 dark:border-error-800">
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

						{!isLogin && (
							<div className="flex items-start gap-2 pt-2">
								<input
									type="checkbox"
									id="tos-agreement-login-page"
									className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
									checked={tosAccepted}
									onChange={(e) => setTosAccepted(e.target.checked)}
								/>
								<label
									htmlFor="tos-agreement-login-page"
									className="text-sm text-text-secondary">
									I agree to the{' '}
									<a
										href="/terms"
										target="_blank"
										rel="noopener noreferrer"
										className="text-primary-600 hover:underline">
										Terms of Service
									</a>{' '}
									and{' '}
									<a
										href="/privacy"
										target="_blank"
										rel="noopener noreferrer"
										className="text-primary-600 hover:underline">
										Privacy Policy
									</a>
									.
								</label>
							</div>
						)}

						<Button
							type="submit"
							disabled={loading}
							loading={loading}
							fullWidth
							size="lg">
							{submitText}
						</Button>
					</form>

					<div className="mt-6 text-center text-sm text-text-tertiary">
						<p>
							{isLogin ? "Don't have an account? " : 'Already have an account? '}
							<Button
								onClick={() => setIsLogin(!isLogin)}
								variant="ghost"
								size="sm"
								className="text-primary-600 hover:underline hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 h-auto p-0">
								{isLogin ? 'Sign up' : 'Sign in'}
							</Button>
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
