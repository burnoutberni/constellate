import { useState, useEffect, useRef, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Event } from '@/types'
import { useThemeColors } from '@/design-system'
import { createLogger } from '@/lib/logger'
import { Button, Input, Spinner } from './ui'
import { api } from '@/lib/api-client'

const log = createLogger('[SearchBar]')

interface RemoteAccountSuggestion {
    handle: string
    username: string
    domain: string
}

interface SearchResults {
    users: User[]
    events: Event[]
    remoteAccountSuggestion: RemoteAccountSuggestion | null
}

export function SearchBar() {
    const colors = useThemeColors()
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResults | null>(null)
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isResolving, setIsResolving] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const searchRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const navigate = useNavigate()

    // Debounced search
    useEffect(() => {
        if (!query.trim()) {
            setResults(null)
            setIsOpen(false)
            return
        }

        setIsLoading(true)
        const timer = setTimeout(async () => {
            try {
                const data = await api.get<SearchResults>('/user-search', { q: query, limit: 5 })
                setResults(data)
                setIsOpen(true)
                setSelectedIndex(-1)
            } catch (error) {
                log.error('Search error:', error)
            } finally {
                setIsLoading(false)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [query])

    // Click outside to close
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Resolve remote account
    const resolveRemoteAccount = async (handle: string) => {
        setIsResolving(true)
        try {
            const data = await api.post<{ user: User }>('/user-search/resolve', { handle }, undefined, 'Failed to resolve account')
            const { user } = data
            // Navigate to the resolved user's profile
            const profilePath = `/@${user.username}`
            navigate(profilePath)
            setQuery('')
            setIsOpen(false)
        } catch (error) {
            log.error('Error resolving account:', error)
        } finally {
            setIsResolving(false)
        }
    }

    // Get all selectable items
    const getSelectableItems = () => {
        const items: Array<{ type: 'user'; data: User } | { type: 'event'; data: Event } | { type: 'remote'; data: RemoteAccountSuggestion }> = []

        if (results) {
            results.users.forEach((user) => items.push({ type: 'user', data: user }))
            results.events.forEach((event) => items.push({ type: 'event', data: event }))
            if (results.remoteAccountSuggestion) {
                items.push({ type: 'remote', data: results.remoteAccountSuggestion })
            }
        }

        return items
    }

    // Handle item click
    const handleItemClick = (item: { type: 'user'; data: User } | { type: 'event'; data: Event } | { type: 'remote'; data: RemoteAccountSuggestion }) => {
        if (item.type === 'user') {
            const user = item.data as User
            const profilePath = `/@${user.username}`
            navigate(profilePath)
        } else if (item.type === 'event') {
            const event = item.data as Event
            const username = event.user?.username
            if (username) {
                navigate(`/@${username}/${event.id}`)
            }
        } else if (item.type === 'remote') {
            const suggestion = item.data as RemoteAccountSuggestion
            resolveRemoteAccount(suggestion.handle)
        }
        setQuery('')
        setIsOpen(false)
    }

    // Keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
        if (!isOpen) {
return
}

        const items = getSelectableItems()

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : prev))
                break
            case 'ArrowUp':
                e.preventDefault()
                setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
                break
            case 'Enter':
                e.preventDefault()
                if (selectedIndex >= 0 && selectedIndex < items.length) {
                    const item = items[selectedIndex]
                    handleItemClick(item)
                }
                break
            case 'Escape':
                setIsOpen(false)
                inputRef.current?.blur()
                break
            default:
                // No action needed for other keys
                break
        }
    }

    const selectableItems = getSelectableItems()

    const searchIcon = (
        <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
        </svg>
    )

    const loadingSpinner = isLoading ? (
        <Spinner size="sm" variant="secondary" />
    ) : undefined

    return (
        <div ref={searchRef} className="relative w-full max-w-md">
            <Input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => query && setIsOpen(true)}
                placeholder="Search events, users, or @user@domain..."
                leftIcon={searchIcon}
                rightIcon={loadingSpinner}
                className="w-full"
            />

            {isOpen && results && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                    {results.users.length > 0 && (
                        <div>
                            <div className="px-4 py-2 text-xs font-semibold text-neutral-500 uppercase bg-neutral-50">
                                Users
                            </div>
                            {results.users.map((user, index) => {
                                const itemIndex = index
                                const isSelected = selectedIndex === itemIndex
                                return (
                                    <Button
                                        key={user.id}
                                        onClick={() => handleItemClick({ type: 'user', data: user })}
                                        variant="ghost"
                                        className={`w-full px-4 py-3 justify-start gap-3 hover:bg-neutral-50 transition-colors ${isSelected ? 'bg-info-50' : ''
                                            }`}
                                    >
                                        {user.profileImage ? (
                                            <img
                                                src={user.profileImage}
                                                alt={user.name || user.username}
                                                className="w-10 h-10 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div
                                                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                                                style={{ backgroundColor: user.displayColor || colors.info[500] }}
                                            >
                                                {(user.name || user.username).charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="flex-1 text-left">
                                            <div className="font-medium text-neutral-900">
                                                {user.name || user.username}
                                            </div>
                                            <div className="text-sm text-neutral-500">
                                                @{user.username}
                                                {user.isRemote && (
                                                    <span className="ml-2 text-xs text-info-600">Remote</span>
                                                )}
                                            </div>
                                        </div>
                                    </Button>
                                )
                            })}
                        </div>
                    )}

                    {results.events.length > 0 && (
                        <div>
                            <div className="px-4 py-2 text-xs font-semibold text-neutral-500 uppercase bg-neutral-50">
                                Events
                            </div>
                            {results.events.map((event, index) => {
                                const itemIndex = results.users.length + index
                                const isSelected = selectedIndex === itemIndex
                                return (
                                    <Button
                                        key={event.id}
                                        onClick={() => handleItemClick({ type: 'event', data: event })}
                                        variant="ghost"
                                        className={`w-full px-4 py-3 justify-start hover:bg-neutral-50 transition-colors ${isSelected ? 'bg-info-50' : ''
                                            }`}
                                    >
                                        <div className="font-medium text-neutral-900">{event.title}</div>
                                        <div className="text-sm text-neutral-500 mt-1">
                                            {new Date(event.startTime).toLocaleDateString()} •{' '}
                                            {event.location || 'No location'}
                                        </div>
                                        {event.user && (
                                            <div className="text-xs text-neutral-400 mt-1">
                                                by @{event.user.username}
                                            </div>
                                        )}
                                    </Button>
                                )
                            })}
                        </div>
                    )}

                    {results.remoteAccountSuggestion && (
                        <div>
                            <div className="px-4 py-2 text-xs font-semibold text-neutral-500 uppercase bg-neutral-50">
                                Remote Account
                            </div>
                            <Button
                                onClick={() => {
                                    if (results.remoteAccountSuggestion) {
                                        handleItemClick({
                                            type: 'remote',
                                            data: results.remoteAccountSuggestion,
                                        })
                                    }
                                }}
                                disabled={isResolving}
                                variant="ghost"
                                className={`w-full px-4 py-3 justify-start gap-3 hover:bg-neutral-50 transition-colors ${selectedIndex === selectableItems.length - 1 ? 'bg-info-50' : ''
                                    }`}
                            >
                                <div className="w-10 h-10 rounded-full bg-info-100 flex items-center justify-center">
                                    <svg
                                        className="w-6 h-6 text-info-600"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                                        />
                                    </svg>
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="font-medium text-neutral-900">
                                        {isResolving ? 'Resolving...' : 'Lookup remote account'}
                                    </div>
                                    <div className="text-sm text-info-600">
                                        {results.remoteAccountSuggestion.handle}
                                    </div>
                                </div>
                            </Button>
                        </div>
                    )}

                    {results.users.length === 0 &&
                        results.events.length === 0 &&
                        !results.remoteAccountSuggestion && (
                            <div className="px-4 py-8 text-center text-neutral-500">
                                No results found
                            </div>
                        )}
                </div>
            )}
        </div>
    )
}
