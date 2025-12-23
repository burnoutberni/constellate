import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { TermsOfServiceAgreement } from '@/components/TermsOfServiceAgreement'
import { Input, Button } from '@/components/ui'
import { api } from '@/lib/api-client'
import { extractErrorMessage } from '@/lib/errorHandling'
import { logger } from '@/lib/logger'

import { useAuth } from '../hooks/useAuth'

export function OnboardingPage() {
	const navigate = useNavigate()
	const { login } = useAuth()
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [tosAccepted, setTosAccepted] = useState(false)
	const [formData, setFormData] = useState({
		email: '',
		username: '',
		name: '',
		password: '',
	})

	// Check if setup is actually needed
	useEffect(() => {
		api.get<{ setupRequired: boolean }>('/setup/status')
			.then((data) => {
				if (!data.setupRequired) {
					navigate('/')
				}
			})
			.catch((setupError) => logger.error('Failed to check setup status:', setupError))
	}, [navigate])

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault()
		setLoading(true)
		setError(null)

		if (!tosAccepted) {
			setError('You must accept the Terms of Service')
			setLoading(false)
			return
		}

		try {
			await api.post('/setup', { ...formData, tosAccepted }, undefined, 'Setup failed')

			// Auto login after setup
			if (formData.password) {
				await login(formData.email, formData.password)
			}

			navigate('/')
		} catch (err) {
			setError(extractErrorMessage(err, 'An error occurred'))
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-background-secondary py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-md w-full space-y-8">
				<div>
					<h2 className="mt-6 text-center text-3xl font-extrabold text-text-primary">
						Welcome to Constellate
					</h2>
					<p className="mt-2 text-center text-sm text-text-secondary">
						Let&apos;s set up your admin account to get started.
					</p>
				</div>
				<form className="mt-8 space-y-6" onSubmit={handleSubmit}>
					<div className="space-y-4">
						<Input
							id="name"
							name="name"
							type="text"
							label="Full Name"
							required
							placeholder="Full Name"
							value={formData.name}
							onChange={(e) => setFormData({ ...formData, name: e.target.value })}
						/>
						<Input
							id="username"
							name="username"
							type="text"
							label="Username"
							required
							placeholder="Username"
							value={formData.username}
							onChange={(e) => setFormData({ ...formData, username: e.target.value })}
						/>
						<Input
							id="email-address"
							name="email"
							type="email"
							label="Email address"
							autoComplete="email"
							required
							placeholder="Email address"
							value={formData.email}
							onChange={(e) => setFormData({ ...formData, email: e.target.value })}
						/>
						<Input
							id="password"
							name="password"
							type="password"
							label="Password"
							autoComplete="new-password"
							required
							placeholder="Password"
							value={formData.password}
							onChange={(e) => setFormData({ ...formData, password: e.target.value })}
						/>
					</div>

					<TermsOfServiceAgreement checked={tosAccepted} onChange={setTosAccepted} />

					{error && (
						<div className="text-error-500 dark:text-error-400 text-sm text-center">
							{error}
						</div>
					)}

					<div>
						<Button
							type="submit"
							disabled={loading}
							loading={loading}
							fullWidth
							variant="primary">
							Create Admin Account
						</Button>
					</div>
				</form>
			</div>
		</div>
	)
}
