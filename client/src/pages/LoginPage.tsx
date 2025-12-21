import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'

import { TermsOfServiceAgreement } from '@/components/TermsOfServiceAgreement'
import { Input, Button, Card, CardContent } from '@/components/ui'
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
	const [success, setSuccess] = useState(false)
	const { user, sendMagicLink } = useAuth()

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
				await sendMagicLink(email)
			} else {
				await sendMagicLink(email, {
					name,
					username,
					tosAccepted,
				})
			}
			setSuccess(true)
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
		setSuccess(false)
	}

	if (success) {
		return (
			<div className="min-h-screen bg-background-secondary flex items-center justify-center p-4">
				<Card className="w-full max-w-md shadow-xl">
					<CardContent className="p-8 text-center">
						<div className="mx-auto w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-6">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="w-8 h-8 text-primary-600 dark:text-primary-400">
								<rect width="20" height="16" x="2" y="4" rx="2" />
								<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
							</svg>
						</div>
						<h2 className="text-2xl font-bold text-text-primary mb-2">Check your email</h2>
						<p className="text-text-secondary mb-8">
							We sent a magic link to <span className="font-medium text-text-primary">{email}</span>
							.
							<br />
							Click the link to {isLogin ? 'sign in' : 'create your account'}.
						</p>
            <Button onClick={() => setSuccess(false)} variant="outline" fullWidth>
              Back
            </Button>
					</CardContent>
				</Card>
			</div>
		)
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
							{isLogin ? 'Send Magic Link' : 'Create Account'}
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
