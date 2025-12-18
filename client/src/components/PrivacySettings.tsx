import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'

import { queryKeys } from '@/hooks/queries'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { api } from '@/lib/api-client'

import { Card, CardHeader, CardTitle, CardContent, Button } from './ui'

interface PrivacySettingsProps {
	profile: {
		autoAcceptFollowers: boolean
		isPublicProfile?: boolean
	}
	userId?: string
}

export function PrivacySettings({ profile, userId }: PrivacySettingsProps) {
	const queryClient = useQueryClient()
	const handleError = useErrorHandler()
	// Derive initial state from profile prop
	const [autoAcceptFollowers, setAutoAcceptFollowers] = useState(profile.autoAcceptFollowers)
	const [isPublicProfile, setIsPublicProfile] = useState(profile.isPublicProfile ?? true)

	// Update local state when profile changes
	useEffect(() => {
		const newAutoAcceptValue = profile.autoAcceptFollowers
		if (autoAcceptFollowers !== newAutoAcceptValue) {
			// Use setTimeout to avoid synchronous setState in effect
			setTimeout(() => setAutoAcceptFollowers(newAutoAcceptValue), 0)
		}
		const newPublicProfileValue = profile.isPublicProfile ?? true
		if (isPublicProfile !== newPublicProfileValue) {
			setTimeout(() => setIsPublicProfile(newPublicProfileValue), 0)
		}
	}, [profile.autoAcceptFollowers, profile.isPublicProfile, autoAcceptFollowers, isPublicProfile])

	const updateProfileMutation = useMutation({
		mutationFn: async (data: { autoAcceptFollowers?: boolean; isPublicProfile?: boolean }) => {
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

	const handleTogglePublicProfile = async () => {
		const newValue = !isPublicProfile
		setIsPublicProfile(newValue)
		try {
			await updateProfileMutation.mutateAsync({ isPublicProfile: newValue })
		} catch (error) {
			// Revert on error
			setIsPublicProfile(!newValue)
			handleError(error, 'Failed to update privacy setting. Please try again.', {
				context: 'PrivacySettings.handleTogglePublicProfile',
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
					{/* Public Profile toggle */}
					<div className="flex items-center justify-between py-4 border-b border-border-default">
						<div className="flex-1 pr-4">
							<h3 className="font-medium text-text-primary">Public Profile</h3>
							<p className="text-sm text-text-tertiary mt-1">
								When enabled, your profile and events are visible to everyone. When
								disabled, only your followers can see your profile and events list.
								Public events you create remain discoverable.
							</p>
						</div>
						<Button
							onClick={handleTogglePublicProfile}
							disabled={updateProfileMutation.isPending}
							variant="ghost"
							className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-background-primary ${
								isPublicProfile
									? 'bg-primary-600'
									: 'bg-neutral-200 dark:bg-neutral-700'
							}`}
							role="switch"
							aria-checked={isPublicProfile}
							aria-label="Public Profile">
							<span
								className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
									isPublicProfile ? 'translate-x-6' : 'translate-x-1'
								}`}
							/>
						</Button>
					</div>

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
								autoAcceptFollowers
									? 'bg-primary-600'
									: 'bg-neutral-200 dark:bg-neutral-700'
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
				</div>
			</CardContent>
		</Card>
	)
}
