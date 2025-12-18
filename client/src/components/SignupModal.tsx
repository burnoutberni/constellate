import { useState, type FormEvent } from 'react'

import { extractErrorMessage } from '@/lib/errorHandling'
import { createLogger } from '@/lib/logger'

import { useAuth } from '../hooks/useAuth'

import { Modal, Button, Input } from './ui'

const log = createLogger('[SignupModal]')

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
	const [tosAccepted, setTosAccepted] = useState(false)
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)
	const { login, signup } = useAuth()
	const submitLabel = isLogin ? 'Sign In' : 'Create Account'

	if (!isOpen) {
		return null
	}

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
			// Close modal and trigger success callback
			onClose()
			onSuccess?.()
		} catch (err: unknown) {
			setError(
				extractErrorMessage(err, 'Authentication failed. Please check your credentials.')
			)
			log.error('Authentication error:', err)
		} finally {
			setLoading(false)
		}
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose} maxWidth="md">
			<div className="card w-full p-8 bg-background-primary shadow-2xl rounded-xl max-h-[90vh] overflow-y-auto border border-border-default">
				{/* Header */}
				<div className="text-center mb-6">
					<div className="text-5xl mb-3">✨</div>
					<h2 className="text-2xl font-bold text-text-primary mb-2">
						{isLogin ? 'Welcome back!' : 'Join Constellate'}
					</h2>
					<p className="text-text-secondary">
						{isLogin ? 'Sign in to continue' : `Sign up to ${getActionText()}`}
					</p>
				</div>

				{error && (
					<div className="bg-error-50 dark:bg-error-900/20 text-error-600 dark:text-error-400 p-3 rounded-lg mb-4 text-sm border border-error-200 dark:border-error-800">
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
								required
								autoFocus
							/>
							<Input
								type="text"
								label="Name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Alice Smith"
								required
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
						autoFocus={isLogin}
					/>

					<Input
						type="password"
						label="Password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="••••••••"
						required
						minLength={8}
						helperText={!isLogin ? 'Must be at least 8 characters' : undefined}
					/>

					{!isLogin && (
						<div className="flex items-start gap-2 pt-2">
							<input
								type="checkbox"
								id="tos-agreement"
								className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
								checked={tosAccepted}
								onChange={(e) => setTosAccepted(e.target.checked)}
							/>
							<label htmlFor="tos-agreement" className="text-sm text-text-secondary">
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
						size="lg"
						className="text-lg font-semibold">
						{submitLabel}
					</Button>
				</form>

				<div className="mt-6 text-center">
					<Button
						onClick={() => {
							setIsLogin(!isLogin)
							setError('')
						}}
						variant="ghost"
						size="sm"
						className="text-sm text-primary-600 hover:text-primary-700 hover:underline dark:text-primary-400 dark:hover:text-primary-300">
						{isLogin
							? "Don't have an account? Sign up"
							: 'Already have an account? Sign in'}
					</Button>
				</div>

				<div className="mt-4 pt-4 border-t border-border-default">
					<Button
						onClick={onClose}
						variant="ghost"
						size="sm"
						fullWidth
						className="text-sm text-text-secondary hover:text-text-primary">
						Cancel
					</Button>
				</div>
			</div>
		</Modal>
	)
}
