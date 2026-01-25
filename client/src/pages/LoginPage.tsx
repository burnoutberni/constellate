import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'

import { TermsOfServiceAgreement } from '@/components/TermsOfServiceAgreement'
import { Input, Button, Card, CardContent, EyeIcon, EyeOffIcon } from '@/components/ui'
import { extractErrorMessage } from '@/lib/errorHandling'
import { createLogger } from '@/lib/logger'

import { useAuth } from '../hooks/useAuth'

const log = createLogger('[LoginPage]')

export function LoginPage() {
	const [isLogin, setIsLogin] = useState(true)
	const [email, setEmail] = useState('')
	const [name, setName] = useState('')
	const [username, setUsername] = useState('')
	const [tosAccepted, setTosAccepted] = useState(false)
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)
	const [password, setPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const { user, login, signup } = useAuth()

	// Redirect if already logged in
	if (user) {
		return <Navigate to="/feed" replace />
	}

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
		} catch (err: unknown) {
			const errorMessage = extractErrorMessage(
				err,
				'Authentication failed. Please check your inputs.'
			)
			setError(errorMessage)
			log.error('Authentication error:', err)
		} finally {
			setLoading(false)
		}
	}

	const toggleMode = () => {
		setIsLogin(!isLogin)
		setError('')
	}

	return (
		<div className="min-h-screen bg-background-secondary flex items-center justify-center p-4">
			<Card className="w-full max-w-md shadow-xl">
				<CardContent className="p-8">
					<div className="text-center mb-8">
						<h1 className="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-2">
							Constellate
						</h1>
						<p className="text-text-secondary">
							{isLogin ? 'Sign in to your account' : 'Create a new account'}
						</p>
					</div>

					{error && (
						<div className="bg-error-50 dark:bg-error-900/20 text-error-600 dark:text-error-400 p-3 rounded-lg mb-6 text-sm border border-error-200 dark:border-error-800 flex items-start">
							<span>{error}</span>
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-4">
						{!isLogin && (
							<div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
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
							</div>
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
							type={showPassword ? 'text' : 'password'}
							label="Password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Your password"
							required
							autoComplete={isLogin ? 'current-password' : 'new-password'}
							rightIcon={
								showPassword ? (
									<EyeOffIcon className="w-5 h-5" />
								) : (
									<EyeIcon className="w-5 h-5" />
								)
							}
							onRightIconClick={() => setShowPassword(!showPassword)}
							rightIconLabel={showPassword ? 'Hide password' : 'Show password'}
						/>

						{!isLogin && (
							<div className="animate-in fade-in slide-in-from-top-2 duration-300">
								<TermsOfServiceAgreement
									id="tos-agreement-login-page"
									checked={tosAccepted}
									onChange={setTosAccepted}
								/>
							</div>
						)}

						<Button type="submit" disabled={loading} loading={loading} fullWidth size="lg">
							{isLogin ? 'Sign In' : 'Create Account'}
						</Button>
					</form>

					<div className="mt-6 text-center text-sm text-text-tertiary">
						<p>
							{isLogin ? "Don't have an account? " : 'Already have an account? '}
							<Button
								onClick={toggleMode}
								variant="ghost"
								size="sm"
								className="text-primary-600 hover:underline hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 h-auto p-0 font-medium">
								{isLogin ? 'Sign up' : 'Sign in'}
							</Button>
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
