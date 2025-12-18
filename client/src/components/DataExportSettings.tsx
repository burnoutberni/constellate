import { useState, useEffect, useCallback } from 'react'

import { useErrorHandler } from '@/hooks/useErrorHandler'
import { api } from '@/lib/api-client'
import { generateId } from '@/lib/utils'
import { useUIStore } from '@/stores'

import { Stack } from './layout'
import { Card, CardHeader, CardTitle, CardContent, Button } from './ui'

const EXPORT_STATUS_POLL_INTERVAL_MS = 5000 // Poll every 5 seconds

type ExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

interface ExportResponse {
	exportId: string
	status: ExportStatus
	message?: string
	createdAt?: string
	updatedAt?: string
	errorMessage?: string
}

export function DataExportSettings() {
	const handleError = useErrorHandler()
	const addToast = useUIStore((state) => state.addToast)
	const [isLoading, setIsLoading] = useState(false)
	const [exportStatus, setExportStatus] = useState<ExportStatus | null>(null)
	const [exportId, setExportId] = useState<string | null>(null)
	const [polling, setPolling] = useState(false)

	const downloadExport = useCallback(
		async (id: string) => {
			try {
				const data = await api.get<object>(
					`/users/me/export/${id}`,
					undefined,
					undefined,
					'Failed to download export'
				)

				// Create a blob and download link
				const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
				const url = window.URL.createObjectURL(blob)
				const a = document.createElement('a')
				a.href = url
				// Include export ID prefix to ensure unique filenames for same-day exports
				const exportIdPrefix = id.substring(0, 8)
				a.download = `constellate-export-${new Date().toISOString().split('T')[0]}-${exportIdPrefix}.json`
				document.body.appendChild(a)
				a.click()
				window.URL.revokeObjectURL(url)
				document.body.removeChild(a)

				addToast({
					id: generateId(),
					message: 'Data export downloaded successfully',
					variant: 'success',
				})

				// Reset state
				setExportId(null)
				setExportStatus(null)
			} catch (error) {
				handleError(error, 'Failed to download export', {
					context: 'DataExportSettings.downloadExport',
				})
			}
		},
		[addToast, handleError]
	)

	// Poll for export status
	useEffect(() => {
		if (!exportId || !polling) {
			return
		}

		const pollInterval = setInterval(async () => {
			try {
				const status = await api.get<ExportResponse>(
					`/users/me/export/${exportId}`,
					undefined,
					undefined,
					'Failed to check export status'
				)

				setExportStatus(status.status)

				if (status.status === 'COMPLETED') {
					setPolling(false)
					// Download the export
					await downloadExport(exportId)
				} else if (status.status === 'FAILED') {
					setPolling(false)
					addToast({
						id: generateId(),
						message: status.errorMessage || 'Export failed',
						variant: 'error',
					})
				}
			} catch (error) {
				handleError(error, 'Failed to check export status', {
					context: 'DataExportSettings.pollStatus',
				})
				setPolling(false)
			}
		}, EXPORT_STATUS_POLL_INTERVAL_MS)

		return () => clearInterval(pollInterval)
	}, [exportId, polling, addToast, handleError, downloadExport])

	const handleExport = async () => {
		setIsLoading(true)
		try {
			// Create export job
			const response = await api.post<ExportResponse>(
				'/users/me/export',
				{},
				undefined,
				'Failed to create export'
			)

			setExportId(response.exportId)
			setExportStatus(response.status)

			if (response.status === 'COMPLETED') {
				// If already completed (e.g., existing export), download immediately
				await downloadExport(response.exportId)
			} else {
				// Start polling for status
				setPolling(true)
				addToast({
					id: generateId(),
					message: 'Export job created. Processing your data...',
					variant: 'success',
				})
			}
		} catch (error) {
			handleError(error, 'Failed to create export', {
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
							You can download a copy of your personal data in JSON format. This
							includes your profile, events, comments, and social connections. The
							export will be processed in the background and you&apos;ll be notified
							when it&apos;s ready.
						</p>
						{exportStatus && (
							<div className="mb-4 p-3 bg-bg-secondary rounded-md">
								<p className="text-sm">
									{exportStatus === 'PENDING' && '⏳ Export queued...'}
									{exportStatus === 'PROCESSING' && '🔄 Processing your data...'}
									{exportStatus === 'COMPLETED' && '✅ Export ready!'}
									{exportStatus === 'FAILED' && '❌ Export failed'}
								</p>
							</div>
						)}
						<Button
							onClick={handleExport}
							loading={isLoading || polling}
							disabled={polling}
							variant="outline">
							{exportStatus === 'PENDING' || exportStatus === 'PROCESSING'
								? 'Processing...'
								: 'Request Data Export'}
						</Button>
					</div>
				</Stack>
			</CardContent>
		</Card>
	)
}
