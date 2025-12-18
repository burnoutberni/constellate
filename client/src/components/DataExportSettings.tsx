import { useState } from 'react'

import { useErrorHandler } from '@/hooks/useErrorHandler'
import { api } from '@/lib/api-client'
import { generateId } from '@/lib/utils'
import { useUIStore } from '@/stores'

import { Stack } from './layout'
import { Card, CardHeader, CardTitle, CardContent, Button } from './ui'

export function DataExportSettings() {
	const handleError = useErrorHandler()
	const addToast = useUIStore((state) => state.addToast)
	const [isLoading, setIsLoading] = useState(false)

	const handleExport = async () => {
		setIsLoading(true)
		try {
			// Fetch the data
			const data = await api.get<object>(
				'/users/me/export',
				undefined,
				undefined,
				'Failed to export data'
			)

			// Create a blob and download link
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
			const url = window.URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = `constellate-export-${new Date().toISOString().split('T')[0]}.json`
			document.body.appendChild(a)
			a.click()
			window.URL.revokeObjectURL(url)
			document.body.removeChild(a)

			addToast({
				id: generateId(),
				message: 'Data export downloaded successfully',
				variant: 'success',
			})
		} catch (error) {
			handleError(error, 'Failed to export data', {
				context: 'DataExportSettings.handleExport',
			})
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Data Export</CardTitle>
			</CardHeader>
			<CardContent>
				<Stack gap="md">
					<div>
						<p className="text-sm text-text-tertiary mb-4">
							You can download a copy of your personal data in JSON format. This includes
							your profile, events, comments, and social connections.
						</p>
						<Button onClick={handleExport} loading={isLoading} variant="outline">
							Download My Data
						</Button>
					</div>
				</Stack>
			</CardContent>
		</Card>
	)
}
