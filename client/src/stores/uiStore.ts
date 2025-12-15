import { create } from 'zustand'

export interface MentionNotification {
	id: string
	commentId: string
	content: string
	eventId: string
	eventTitle?: string
	eventOwnerHandle?: string
	handle?: string
	author?: {
		id?: string
		username?: string
		name?: string | null
	}
	createdAt: string
}

export type ToastVariant = 'error' | 'success'

export interface Toast {
	id: string
	message: string
	variant: ToastVariant
	// createdAt is optional in input (ISO string format), but always set by addToast
	// If not provided, it will be automatically set to the current time as an ISO string
	createdAt?: string
}

// Stored toasts always have createdAt set
export type StoredToast = Toast & { createdAt: string }

export const MAX_TOASTS = 5
export const MAX_MESSAGE_LENGTH = 1000 // Maximum length for toast messages to prevent UI issues

interface UIState {
	// Create Event Modal
	createEventModalOpen: boolean

	// Calendar
	calendarView: 'month' | 'week' | 'day'
	calendarCurrentDate: Date

	// Search
	searchQuery: string
	searchIsOpen: boolean
	searchSelectedIndex: number

	// SSE Connection Status
	sseConnected: boolean

	// Followers/Following Modal
	followersModalOpen: boolean
	followersModalUsername: string | null
	followersModalType: 'followers' | 'following' | null
	mentionNotifications: MentionNotification[]
	toasts: StoredToast[]

	// Actions
	openCreateEventModal: () => void
	closeCreateEventModal: () => void
	setCalendarView: (view: 'month' | 'week' | 'day') => void
	setCalendarDate: (date: Date) => void
	setSearchQuery: (query: string) => void
	setSearchIsOpen: (isOpen: boolean) => void
	setSearchSelectedIndex: (index: number) => void
	setSSEConnected: (connected: boolean) => void
	openFollowersModal: (username: string, type: 'followers' | 'following') => void
	closeFollowersModal: () => void
	addMentionNotification: (notification: MentionNotification) => void
	dismissMentionNotification: (id: string) => void
	addToast: (toast: Toast) => void
	dismissToast: (id: string) => void
	clearToasts: () => void
}

export const useUIStore = create<UIState>((set) => ({
	// Initial state
	createEventModalOpen: false,
	calendarView: 'month',
	calendarCurrentDate: new Date(),
	searchQuery: '',
	searchIsOpen: false,
	searchSelectedIndex: -1,
	sseConnected: false,
	followersModalOpen: false,
	followersModalUsername: null,
	followersModalType: null,
	mentionNotifications: [],
	toasts: [],

	// Actions
	openCreateEventModal: () => set({ createEventModalOpen: true }),
	closeCreateEventModal: () => set({ createEventModalOpen: false }),
	setCalendarView: (view) => set({ calendarView: view }),
	setCalendarDate: (date) => set({ calendarCurrentDate: date }),
	setSearchQuery: (query) => set({ searchQuery: query }),
	setSearchIsOpen: (isOpen) => set({ searchIsOpen: isOpen }),
	setSearchSelectedIndex: (index) => set({ searchSelectedIndex: index }),
	setSSEConnected: (connected) => set({ sseConnected: connected }),
	openFollowersModal: (username, type) =>
		set({
			followersModalOpen: true,
			followersModalUsername: username,
			followersModalType: type,
		}),
	closeFollowersModal: () =>
		set({
			followersModalOpen: false,
			followersModalUsername: null,
			followersModalType: null,
		}),
	addMentionNotification: (notification) =>
		set((state) => {
			const existing = state.mentionNotifications.filter(
				(item) => item.id !== notification.id
			)
			// Keep the most recent 20 notifications
			return {
				mentionNotifications: [notification, ...existing].slice(0, 20),
			}
		}),
	dismissMentionNotification: (id) =>
		set((state) => ({
			mentionNotifications: state.mentionNotifications.filter((item) => item.id !== id),
		})),
	addToast: (toast) =>
		set((state) => {
			// Filter out any existing toast with the same ID to prevent duplicates
			// If the same toast occurs multiple times with different IDs (via crypto.randomUUID()),
			// both will be shown. Only exact ID matches are removed.
			const existing = state.toasts.filter((item) => item.id !== toast.id)

			// Validate and truncate message length to prevent UI issues and potential abuse
			const message =
				typeof toast.message === 'string' && toast.message.length > 0
					? toast.message.slice(0, MAX_MESSAGE_LENGTH)
					: 'Notification'

			// Validate variant to prevent invalid values (defensive programming)
			const variant: ToastVariant =
				toast.variant === 'error' || toast.variant === 'success' ? toast.variant : 'success'

			// Ensure createdAt is always set as an ISO string (never a number/timestamp)
			const toastWithTimestamp: StoredToast = {
				...toast,
				message,
				variant,
				createdAt: toast.createdAt || new Date().toISOString(),
			}
			// Keep the most recent toasts to balance visibility with memory usage
			// New toasts are added at the beginning, so slice(0, MAX_TOASTS) keeps the most recent
			return {
				toasts: [toastWithTimestamp, ...existing].slice(0, MAX_TOASTS),
			}
		}),
	dismissToast: (id) =>
		set((state) => ({
			toasts: state.toasts.filter((item) => item.id !== id),
		})),
	clearToasts: () => set({ toasts: [] }),
}))
