import { useState } from 'react'

import { useErrorHandler } from '@/hooks/useErrorHandler'
import { api } from '@/lib/api-client'
import { extractErrorMessage } from '@/lib/errorHandling'
import { TOAST_ON_LOAD_KEY } from '@/lib/storageConstants'
import { generateId } from '@/lib/utils'
import { useUIStore } from '@/stores'

import { useAuth } from '../hooks/useAuth'

import { Stack } from './layout'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from './ui'

interface AccountSettingsProps {
	profile: {
		email: string | null
		username: string
		hasPassword?: boolean
	}
}

export function AccountSettings({ profile }: AccountSettingsProps) {
	const { logout } = useAuth()
	const handleError = useErrorHandler()
	const addToast = useUIStore((state) => state.addToast)
	const [showPasswordChange, setShowPasswordChange] = useState(false)
	const [currentPassword, setCurrentPassword] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [passwordError, setPasswordError] = useState('')
	const [isChangingPassword, setIsChangingPassword] = useState(false)

	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
	const [deleteConfirmText, setDeleteConfirmText] = useState('')

	const hasPassword = profile.hasPassword ?? false

	const handlePasswordChange = async () => {
		setPasswordError('')

		// Validation
		if (hasPassword && !currentPassword) {
			setPasswordError('Current password is required')
			return
		}

		if (!newPassword || !confirmPassword) {
			setPasswordError('All fields are required')
			return
		}

		if (newPassword.length < 8) {
			setPasswordError('New password must be at least 8 characters')
			return
		}

		if (newPassword !== confirmPassword) {
			setPasswordError('New passwords do not match')
			return
		}

		setIsChangingPassword(true)

		try {
			if (hasPassword) {
				// Use better-auth's change password endpoint
				await api.post(
					'/auth/change-password',
					{
						currentPassword,
						newPassword,
					},
					undefined,
					'Failed to change password'
				)
			} else {
				// Use better-auth's set password endpoint
				await api.post(
					'/auth/set-password',
					{
						newPassword,
						password: newPassword, // Some implementations might look for 'password'
					},
					undefined,
					'Failed to set password'
				)
			}

			// Success
			addToast({
				id: generateId(),
				message: hasPassword ? 'Password changed successfully!' : 'Password set successfully!',
				variant: 'success',
			})
			setShowPasswordChange(false)
			setCurrentPassword('')
			setNewPassword('')
			setConfirmPassword('')
		} catch (error) {
			const errorMessage = extractErrorMessage(
				error,
				hasPassword
					? 'Failed to change password. Please try again.'
					: 'Failed to set password. Please try again.'
			)
			setPasswordError(errorMessage)
			handleError(error, errorMessage, { context: 'AccountSettings.handlePasswordChange' })
		} finally {
			setIsChangingPassword(false)
		}
	}

	const handleDeleteAccount = async () => {
		if (deleteConfirmText !== profile.username) {
			handleError(
				new Error('Please type your username correctly to confirm deletion'),
				'Confirmation required',
				{ context: 'AccountSettings.handleDeleteAccount' }
			)
			return
		}

		// Confirmation is already handled by the inline UI (showDeleteConfirm)
		// No need for additional confirm() call

		try {
			// Note: This endpoint may need to be implemented in the backend
			await api.delete('/profile', undefined, 'Failed to delete account')

			// Store toast message in sessionStorage to display after redirect
			// IMPORTANT: message must be a static, trusted string (no user input or backend error messages)
			// This prevents XSS if sessionStorage is compromised via other vulnerabilities
			sessionStorage.setItem(
				TOAST_ON_LOAD_KEY,
				JSON.stringify({
					message: 'Your account has been deleted.',
					variant: 'success',
				})
			)

			// Log out and redirect immediately
			await logout()
			window.location.href = '/'
		} catch (error) {
			handleError(
				error,
				'Failed to delete account. This feature may not be available yet. Please contact support.',
				{ context: 'AccountSettings.handleDeleteAccount' }
			)
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Account Management</CardTitle>
			</CardHeader>
			<CardContent>
				<Stack gap="lg">
					{/* Email Display */}
					<Stack gap="xs">
						<label className="block text-sm font-medium text-text-secondary">
							Email Address
						</label>
						<p className="text-text-primary">{profile.email || 'No email set'}</p>
						<p className="text-sm text-text-tertiary">
							Email changes are not yet supported. Contact your instance administrator
							if you need to change your email.
						</p>
					</Stack>

					{/* Password Change */}
					<Stack gap="md" className="border-t border-border-default pt-6">
						<div>
							<h3 className="font-medium text-text-primary mb-1">
								{hasPassword ? 'Change Password' : 'Set Password'}
							</h3>
							<p className="text-sm text-text-tertiary">
								{hasPassword
									? 'Update your password to keep your account secure.'
									: 'Add a password to your account for an alternative login method.'}
							</p>
						</div>

						{!showPasswordChange ? (
							<div>
								<Button
									variant="secondary"
									onClick={() => setShowPasswordChange(true)}>
									{hasPassword ? 'Change Password' : 'Set Password'}
								</Button>
							</div>
						) : (
							<Stack gap="md" className="bg-background-secondary p-4 rounded-lg">
								{hasPassword && (
									<Input
										type="password"
										label="Current Password"
										value={currentPassword}
										onChange={(e) => setCurrentPassword(e.target.value)}
										placeholder="Enter your current password"
										autoComplete="current-password"
									/>
								)}

								<Input
									type="password"
									label="New Password"
									value={newPassword}
									onChange={(e) => setNewPassword(e.target.value)}
									placeholder="Enter a new password (min 8 characters)"
									autoComplete="new-password"
									helperText="Must be at least 8 characters"
								/>

								<Input
									type="password"
									label="Confirm New Password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									placeholder="Confirm your new password"
									autoComplete="new-password"
								/>

								{passwordError && (
									<p className="text-sm text-error-600 dark:text-error-400">
										{passwordError}
									</p>
								)}

								<div className="flex gap-2">
									<Button
										onClick={handlePasswordChange}
										loading={isChangingPassword}
										disabled={isChangingPassword}>
										{hasPassword ? 'Update Password' : 'Set Password'}
									</Button>
									<Button
										variant="ghost"
										onClick={() => {
											setShowPasswordChange(false)
											setCurrentPassword('')
											setNewPassword('')
											setConfirmPassword('')
											setPasswordError('')
										}}>
										Cancel
									</Button>
								</div>
							</Stack>
						)}
					</Stack>

					{/* Delete Account */}
					<Stack gap="md" className="border-t border-border-default pt-6">
						<div>
							<h3 className="font-medium text-error-600 dark:text-error-400 mb-1">
								Danger Zone
							</h3>
							<p className="text-sm text-text-tertiary">
								Once you delete your account, there is no going back. Please be
								certain.
							</p>
						</div>

						{!showDeleteConfirm ? (
							<div>
								<Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
									Delete Account
								</Button>
							</div>
						) : (
							<Stack
								gap="md"
								className="bg-error-50 dark:bg-error-950 p-4 rounded-lg border border-error-200 dark:border-error-800">
								<p className="text-sm text-error-700 dark:text-error-300 font-medium">
									This action cannot be undone. This will permanently delete your
									account and remove all your data from our servers.
								</p>

								<Input
									label={`Type "${profile.username}" to confirm`}
									value={deleteConfirmText}
									onChange={(e) => setDeleteConfirmText(e.target.value)}
									placeholder={profile.username}
									error={
										deleteConfirmText !== '' &&
										deleteConfirmText !== profile.username
									}
								/>

								<div className="flex gap-2">
									<Button
										variant="danger"
										onClick={handleDeleteAccount}
										disabled={deleteConfirmText !== profile.username}>
										I understand, delete my account
									</Button>
									<Button
										variant="ghost"
										onClick={() => {
											setShowDeleteConfirm(false)
											setDeleteConfirmText('')
										}}>
										Cancel
									</Button>
								</div>
							</Stack>
						)}
					</Stack>
				</Stack>
			</CardContent>
		</Card>
	)
}
