import { useEffect, useRef, useCallback, useState } from 'react'

// Exponential backoff polling configuration
const INITIAL_POLL_INTERVAL_MS = 5000 // Start with 5 seconds for faster feedback
const MAX_POLL_INTERVAL_MS = 35000 // Cap at 35 seconds (backend processor runs every 30 seconds)
const BACKOFF_MULTIPLIER = 1.5 // Multiply interval by this factor each time

export interface ExponentialBackoffOptions {
	initialIntervalMs?: number
	maxIntervalMs?: number
	backoffMultiplier?: number
	onError?: (error: unknown) => void
}

export interface UseExponentialBackoffResult<T> {
	isPolling: boolean
	startPolling: () => void
	stopPolling: () => void
	currentStatus: T | null
}

/**
 * Custom hook for polling with exponential backoff.
 *
 * @param pollFn - Function that performs the poll and returns the current status
 * @param isComplete - Function that checks if the status indicates completion
 * @param isFailed - Function that checks if the status indicates failure
 * @param onComplete - Callback when polling completes successfully
 * @param onFailure - Callback when polling fails
 * @param options - Optional configuration for backoff behavior
 * @returns Object with polling state and control functions
 */
export function useExponentialBackoff<T>(
	pollFn: () => Promise<T>,
	isComplete: (status: T) => boolean,
	isFailed: (status: T) => boolean,
	onComplete: (status: T) => void | Promise<void>,
	onFailure: (status: T) => void | Promise<void>,
	options: ExponentialBackoffOptions = {}
): UseExponentialBackoffResult<T> {
	const {
		initialIntervalMs = INITIAL_POLL_INTERVAL_MS,
		maxIntervalMs = MAX_POLL_INTERVAL_MS,
		backoffMultiplier = BACKOFF_MULTIPLIER,
		onError,
	} = options

	const [isPolling, setIsPolling] = useState(false)
	const [currentStatus, setCurrentStatus] = useState<T | null>(null)
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const currentPollIntervalRef = useRef<number>(initialIntervalMs)
	const isPollingRef = useRef(false)

	const stopPolling = useCallback(() => {
		isPollingRef.current = false
		setIsPolling(false)
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current)
			timeoutRef.current = null
		}
	}, [])

	const startPolling = useCallback(() => {
		// Reset interval when starting a new poll
		currentPollIntervalRef.current = initialIntervalMs
		isPollingRef.current = true
		setIsPolling(true)
	}, [initialIntervalMs])

	useEffect(() => {
		if (!isPolling) {
			return
		}

		const pollStatus = async () => {
			try {
				const status = await pollFn()
				setCurrentStatus(status)

				if (isComplete(status)) {
					stopPolling()
					await onComplete(status)
				} else if (isFailed(status)) {
					stopPolling()
					await onFailure(status)
				} else {
					// Calculate next interval with exponential backoff
					const nextInterval = Math.min(
						currentPollIntervalRef.current * backoffMultiplier,
						maxIntervalMs
					)
					currentPollIntervalRef.current = nextInterval

					// Schedule next poll only if still polling and not completed/failed
					if (isPollingRef.current) {
						timeoutRef.current = setTimeout(pollStatus, nextInterval)
					}
				}
			} catch (error) {
				stopPolling()
				if (onError) {
					onError(error)
				}
			}
		}

		// Start the first poll with initial interval
		timeoutRef.current = setTimeout(pollStatus, initialIntervalMs)

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
				timeoutRef.current = null
			}
		}
	}, [
		isPolling,
		pollFn,
		isComplete,
		isFailed,
		onComplete,
		onFailure,
		stopPolling,
		initialIntervalMs,
		maxIntervalMs,
		backoffMultiplier,
		onError,
	])

	return {
		isPolling,
		startPolling,
		stopPolling,
		currentStatus,
	}
}
