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

export interface ErrorToast {
    id: string
    message: string
    createdAt?: string // Optional in input, but always set by addErrorToast
}

// Stored error toasts always have createdAt set
type StoredErrorToast = ErrorToast & { createdAt: string }

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
    errorToasts: StoredErrorToast[]
    
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
    addErrorToast: (toast: ErrorToast) => void
    dismissErrorToast: (id: string) => void
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
    errorToasts: [],
    
    // Actions
    openCreateEventModal: () => set({ createEventModalOpen: true }),
    closeCreateEventModal: () => set({ createEventModalOpen: false }),
    setCalendarView: (view) => set({ calendarView: view }),
    setCalendarDate: (date) => set({ calendarCurrentDate: date }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setSearchIsOpen: (isOpen) => set({ searchIsOpen: isOpen }),
    setSearchSelectedIndex: (index) => set({ searchSelectedIndex: index }),
    setSSEConnected: (connected) => set({ sseConnected: connected }),
    openFollowersModal: (username, type) => set({
        followersModalOpen: true,
        followersModalUsername: username,
        followersModalType: type,
    }),
    closeFollowersModal: () => set({
        followersModalOpen: false,
        followersModalUsername: null,
        followersModalType: null,
    }),
    addMentionNotification: (notification) => set((state) => {
        const existing = state.mentionNotifications.filter((item) => item.id !== notification.id)
        return {
            mentionNotifications: [notification, ...existing].slice(0, 20),
        }
    }),
    dismissMentionNotification: (id) => set((state) => ({
        mentionNotifications: state.mentionNotifications.filter((item) => item.id !== id),
    })),
    addErrorToast: (toast) => set((state) => {
        // Filter out any existing toast with the same ID to prevent duplicates
        // If the same error occurs multiple times with different IDs (via crypto.randomUUID()),
        // both will be shown. Only exact ID matches are removed.
        const existing = state.errorToasts.filter((item) => item.id !== toast.id)
        const toastWithTimestamp: StoredErrorToast = {
            ...toast,
            createdAt: toast.createdAt || new Date().toISOString(),
        }
        return {
            errorToasts: [toastWithTimestamp, ...existing].slice(0, 20),
        }
    }),
    dismissErrorToast: (id) => set((state) => ({
        errorToasts: state.errorToasts.filter((item) => item.id !== id),
    })),
}))

