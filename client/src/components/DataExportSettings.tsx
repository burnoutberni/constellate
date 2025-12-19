import { useState, useCallback, useRef } from 'react'

import { useErrorHandler } from '@/hooks/useErrorHandler'
import { useExponentialBackoff } from '@/hooks/useExponentialBackoff'
import { api } from '@/lib/api-client'
import { generateId } from '@/lib/utils'
import { useUIStore } from '@/stores'

import { Stack } from './layout'
import { Card, CardHeader, CardTitle, CardContent, Button } from './ui'

type ExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

interface ExportResponse {
	exportId: string
	status: ExportStatus
	message?: string
	createdAt?: string
	updatedAt?: string
	errorMessage?: string
}

// Union type for polling responses: either status object or completed data
type ExportPollResponse = ExportResponse | object

// Type guard to check if response is a status object
function isExportResponse(response: ExportPollResponse): response is ExportResponse {
	return 'status' in response && 'exportId' in response
}

export function DataExportSettings() {
	const handleError = useErrorHandler()
	const addToast = useUIStore((state) => state.addToast)
	const [isLoading, setIsLoading] = useState(false)
	const [exportStatus, setExportStatus] = useState<ExportStatus | null>(null)
	const [exportCreatedAt, setExportCreatedAt] = useState<string | null>(null)
	// Ref to capture exportId when polling starts, preventing race conditions
	const pollingExportIdRef = useRef<string | null>(null)

	const downloadExport = useCallback(
		async (id: string, preloadedData?: object) => {
			try {
				// Use pre-loaded data if available, otherwise fetch it
				const data =
					preloadedData ??
					(await api.get<object>(
						`/users/me/export/${id}`,
						undefined,
						undefined,
						'Failed to download export'
					))

				// Create a blob and download link
				const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
				const url = window.URL.createObjectURL(blob)
				const a = document.createElement('a')
				a.href = url
				// Include export ID prefix to ensure unique filenames for same-day exports
				const exportIdPrefix = id.substring(0, 8)
				// Use the export creation date from state (should always be available from POST/polling responses)
				// Fallback to current date only if somehow missing (should not happen in normal flow)
				const dateStr = exportCreatedAt
					? new Date(exportCreatedAt).toISOString().split('T')[0]
					: new Date().toISOString().split('T')[0]
				a.download = `constellate-export-${dateStr}-${exportIdPrefix}.json`
				document.body.appendChild(a)
				a.click()
				// Delay cleanup to allow browser to initiate download
				// This prevents race conditions on slower systems
				setTimeout(() => {
					window.URL.revokeObjectURL(url)
					document.body.removeChild(a)
				}, 100)

				addToast({
					id: generateId(),
					message: 'Data export downloaded successfully',
					variant: 'success',
				})

				// Reset state
				setExportStatus(null)
				setExportCreatedAt(null)
			} catch (error) {
				handleError(error, 'Failed to download export', {
					context: 'DataExportSettings.downloadExport',
				})
			}
		},
		[addToast, handleError, exportCreatedAt]
	)

	// Poll for export status using exponential backoff
	const { isPolling, startPolling, stopPolling } = useExponentialBackoff(
		useCallback(async () => {
			// Use ref to get the exportId captured when polling started
			// This prevents race conditions if exportId state changes during polling
			const currentExportId = pollingExportIdRef.current
			if (!currentExportId) {
				throw new Error('Export ID is required for polling')
			}
			const response = await api.get<ExportPollResponse>(
				`/users/me/export/${currentExportId}`,
				undefined,
				undefined,
				'Failed to check export status'
			)
			// Only update status if response is a status object (not completed data)
			if (isExportResponse(response)) {
				setExportStatus(response.status)
				if (response.createdAt) {
					setExportCreatedAt(response.createdAt)
				}
			}
			return response
		}, []),
		// Completed when response is the data object (no status property)
		useCallback((response: ExportPollResponse) => !isExportResponse(response), []),
		// Failed when response is a status object with FAILED status
		useCallback(
			(response: ExportPollResponse) =>
				isExportResponse(response) && response.status === 'FAILED',
			[]
		),
		useCallback(
			async (response: ExportPollResponse) => {
				// When completed, response is the data object
				// Use ref to get the exportId captured when polling started
				// This prevents race conditions if exportId state changes during polling
				const currentExportId = pollingExportIdRef.current
				if (!currentExportId) {
					throw new Error('Export ID is required for download')
				}
				// Pass the completed data directly to avoid redundant API call
				await downloadExport(currentExportId, response as object)
				// Clear the ref after completion
				pollingExportIdRef.current = null
			},
			[downloadExport]
		),
		useCallback(
			async (response: ExportPollResponse) => {
				// When failed, response is a status object
				if (isExportResponse(response)) {
					addToast({
						id: generateId(),
						message: response.errorMessage || 'Export failed',
						variant: 'error',
					})
				}
				// Clear the ref after failure
				pollingExportIdRef.current = null
			},
			[addToast]
		),
		{
			onError: (error) => {
				handleError(error, 'Failed to check export status', {
					context: 'DataExportSettings.pollStatus',
				})
				// Clear the ref on error
				pollingExportIdRef.current = null
			},
		}
	)

	const handleExport = async () => {
		setIsLoading(true)
		try {
			// Stop any existing polling to prevent race conditions
			stopPolling()

			// Create export job
			const response = await api.post<ExportResponse>(
				'/users/me/export',
				{},
				undefined,
				'Failed to create export'
			)

			setExportStatus(response.status)
			if (response.createdAt) {
				setExportCreatedAt(response.createdAt)
			}

			if (response.status === 'COMPLETED') {
				// If already completed (e.g., existing export), download immediately
				await downloadExport(response.exportId)
			} else {
				// Capture exportId in ref before starting polling to prevent race conditions
				// This ensures callbacks use the correct ID even if state changes
				pollingExportIdRef.current = response.exportId
				// Start polling for status
				startPolling()
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
							loading={isLoading || isPolling}
							disabled={isPolling}
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
