import { useCallback } from 'react'
import { logger } from '@/lib/logger'

const DRAFT_KEY = 'event-creation-draft'
const DRAFT_TIMESTAMP_KEY = 'event-creation-draft-timestamp'
const DRAFT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

interface EventDraft {
	title: string
	summary: string
	location: string
	locationLatitude: string
	locationLongitude: string
	url: string
	headerImage: string
	timezone: string
	startTime: string
	endTime: string
	visibility: string
	recurrencePattern: string
	recurrenceEndDate: string
	tags: string[]
}

/**
 * Hook for managing event creation draft state in localStorage
 * Automatically saves form data and loads it when the component mounts
 */
export function useEventDraft() {
	const saveDraft = useCallback((draft: EventDraft) => {
		try {
			// Only save if there's meaningful content
			if (draft.title || draft.summary || draft.location || draft.tags.length > 0) {
				localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
				localStorage.setItem(DRAFT_TIMESTAMP_KEY, Date.now().toString())
			}
		} catch (error) {
			logger.error('Failed to save draft:', error)
		}
	}, [])

	const clearDraft = useCallback(() => {
		try {
			localStorage.removeItem(DRAFT_KEY)
			localStorage.removeItem(DRAFT_TIMESTAMP_KEY)
		} catch (error) {
			logger.error('Failed to clear draft:', error)
		}
	}, [])

	const loadDraft = useCallback((): EventDraft | null => {
		try {
			const draftStr = localStorage.getItem(DRAFT_KEY)
			const timestampStr = localStorage.getItem(DRAFT_TIMESTAMP_KEY)

			if (!draftStr || !timestampStr) {
				return null
			}

			const timestamp = parseInt(timestampStr, 10)
			const now = Date.now()

			// Check if draft has expired
			if (now - timestamp > DRAFT_EXPIRY_MS) {
				clearDraft()
				return null
			}

			const draft = JSON.parse(draftStr) as EventDraft
			return draft
		} catch (error) {
			logger.error('Failed to load draft:', error)
			return null
		}
	}, [clearDraft])

	const hasDraft = useCallback((): boolean => {
		try {
			const draftStr = localStorage.getItem(DRAFT_KEY)
			const timestampStr = localStorage.getItem(DRAFT_TIMESTAMP_KEY)

			if (!draftStr || !timestampStr) {
				return false
			}

			const timestamp = parseInt(timestampStr, 10)
			const now = Date.now()

			// Check if draft has expired
			if (now - timestamp > DRAFT_EXPIRY_MS) {
				clearDraft()
				return false
			}

			return true
		} catch (error) {
			logger.error('Failed to check draft status:', error)
			return false
		}
	}, [clearDraft])

	return { saveDraft, loadDraft, clearDraft, hasDraft }
}
