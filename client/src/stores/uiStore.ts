import { create } from 'zustand'

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
}))

