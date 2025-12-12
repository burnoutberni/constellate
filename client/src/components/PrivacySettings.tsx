import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'


import { queryKeys } from '@/hooks/queries'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { api } from '@/lib/api-client'

import { Card, CardHeader, CardTitle, CardContent, Button } from './ui'

interface PrivacySettingsProps {
	profile: {
		autoAcceptFollowers: boolean
	}
	userId?: string
}

export function PrivacySettings({ profile, userId }: PrivacySettingsProps) {
	const queryClient = useQueryClient()
	const handleError = useErrorHandler()
	// Derive initial state from profile prop
	const [autoAcceptFollowers, setAutoAcceptFollowers] = useState(
		profile.autoAcceptFollowers
	)

	// Update local state when profile changes
	useEffect(() => {
		const newValue = profile.autoAcceptFollowers
		if (autoAcceptFollowers !== newValue) {
			// Use setTimeout to avoid synchronous setState in effect
			setTimeout(() => setAutoAcceptFollowers(newValue), 0)
		}
	}, [profile.autoAcceptFollowers, autoAcceptFollowers])

	const updateProfileMutation = useMutation({
		mutationFn: async (data: { autoAcceptFollowers?: boolean }) => {
			return api.put('/profile', data, undefined, 'Failed to update privacy settings')
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.users.currentProfile(userId) })
		},
	})

	const handleToggleAutoAccept = async () => {
		const newValue = !autoAcceptFollowers
		setAutoAcceptFollowers(newValue)
		try {
			await updateProfileMutation.mutateAsync({ autoAcceptFollowers: newValue })
		} catch (error) {
			// Revert on error
			setAutoAcceptFollowers(!newValue)
			handleError(error, 'Failed to update privacy setting. Please try again.', {
				context: 'PrivacySettings.handleToggleAutoAccept',
			})
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Privacy Settings</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{/* Auto-accept followers toggle */}
					<div className="flex items-center justify-between py-4 border-b border-border-default">
						<div className="flex-1 pr-4">
							<h3 className="font-medium text-text-primary">Auto-accept followers</h3>
							<p className="text-sm text-text-tertiary mt-1">
								Automatically accept follow requests. When disabled, you&apos;ll
								need to manually approve each follower.
							</p>
						</div>
						<Button
							onClick={handleToggleAutoAccept}
							disabled={updateProfileMutation.isPending}
							variant="ghost"
							className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-background-primary ${
								autoAcceptFollowers ? 'bg-primary-600' : 'bg-background-tertiary'
							}`}
							role="switch"
							aria-checked={autoAcceptFollowers}
							aria-label="Auto-accept followers">
							<span
								className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
									autoAcceptFollowers ? 'translate-x-6' : 'translate-x-1'
								}`}
							/>
						</Button>
					</div>

					{/* Additional privacy settings can be added here in the future */}
					<div className="text-sm text-text-tertiary">
						More privacy options will be available in future updates.
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
