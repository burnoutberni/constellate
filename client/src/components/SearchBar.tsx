import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

interface User {
    id: string
    username: string
    name: string | null
    profileImage: string | null
    displayColor: string
    isRemote: boolean
    externalActorUrl: string | null
}

interface Event {
    id: string
    title: string
    summary: string | null
    startTime: string
    location: string | null
    user: {
        id: string
        username: string
        name: string | null
        displayColor: string
        profileImage: string | null
    } | null
    _count: {
        attendance: number
        likes: number
    }
}

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
                const response = await fetch(
                    `/api/user-search?q=${encodeURIComponent(query)}&limit=5`
                )
                if (response.ok) {
                    const data = await response.json()
                    setResults(data)
                    setIsOpen(true)
                    setSelectedIndex(-1)
                }
            } catch (error) {
                console.error('Search error:', error)
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
            const response = await fetch('/api/user-search/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ handle }),
            })

            if (response.ok) {
                const data = await response.json()
                const user = data.user
                // Navigate to the resolved user's profile
                const profilePath = user.isRemote
                    ? `/@${user.username}`
                    : `/@${user.username}`
                navigate(profilePath)
                setQuery('')
                setIsOpen(false)
            } else {
                console.error('Failed to resolve account')
            }
        } catch (error) {
            console.error('Error resolving account:', error)
        } finally {
            setIsResolving(false)
        }
    }

    // Get all selectable items
    const getSelectableItems = () => {
        const items: Array<{ type: 'user'; data: User } | { type: 'event'; data: Event } | { type: 'remote'; data: RemoteAccountSuggestion }> = []

        if (results) {
            results.users.forEach(user => items.push({ type: 'user', data: user }))
            results.events.forEach(event => items.push({ type: 'event', data: event }))
            if (results.remoteAccountSuggestion) {
                items.push({ type: 'remote', data: results.remoteAccountSuggestion })
            }
        }

        return items
    }

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) return

        const items = getSelectableItems()

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setSelectedIndex(prev => (prev < items.length - 1 ? prev + 1 : prev))
                break
            case 'ArrowUp':
                e.preventDefault()
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
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
        }
    }

    // Handle item click
    const handleItemClick = (item: { type: 'user'; data: User } | { type: 'event'; data: Event } | { type: 'remote'; data: RemoteAccountSuggestion }) => {
        if (item.type === 'user') {
            const user = item.data as User
            const profilePath = user.isRemote ? `/@${user.username}` : `/@${user.username}`
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

    const selectableItems = getSelectableItems()

    return (
        <div ref={searchRef} className="relative w-full max-w-md">
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => query && setIsOpen(true)}
                    placeholder="Search events, users, or @user@domain..."
                    className="w-full px-4 py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <svg
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
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
                {isLoading && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                    </div>
                )}
            </div>

            {isOpen && results && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                    {results.users.length > 0 && (
                        <div>
                            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                                Users
                            </div>
                            {results.users.map((user, index) => {
                                const itemIndex = index
                                const isSelected = selectedIndex === itemIndex
                                return (
                                    <button
                                        key={user.id}
                                        onClick={() => handleItemClick({ type: 'user', data: user })}
                                        className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''
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
                                                style={{ backgroundColor: user.displayColor }}
                                            >
                                                {(user.name || user.username).charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="flex-1 text-left">
                                            <div className="font-medium text-gray-900">
                                                {user.name || user.username}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                @{user.username}
                                                {user.isRemote && (
                                                    <span className="ml-2 text-xs text-blue-600">Remote</span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {results.events.length > 0 && (
                        <div>
                            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                                Events
                            </div>
                            {results.events.map((event, index) => {
                                const itemIndex = results.users.length + index
                                const isSelected = selectedIndex === itemIndex
                                return (
                                    <button
                                        key={event.id}
                                        onClick={() => handleItemClick({ type: 'event', data: event })}
                                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''
                                            }`}
                                    >
                                        <div className="font-medium text-gray-900">{event.title}</div>
                                        <div className="text-sm text-gray-500 mt-1">
                                            {new Date(event.startTime).toLocaleDateString()} •{' '}
                                            {event.location || 'No location'}
                                        </div>
                                        {event.user && (
                                            <div className="text-xs text-gray-400 mt-1">
                                                by @{event.user.username}
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {results.remoteAccountSuggestion && (
                        <div>
                            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                                Remote Account
                            </div>
                            <button
                                onClick={() =>
                                    handleItemClick({
                                        type: 'remote',
                                        data: results.remoteAccountSuggestion,
                                    })
                                }
                                disabled={isResolving}
                                className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${selectedIndex === selectableItems.length - 1 ? 'bg-blue-50' : ''
                                    }`}
                            >
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                    <svg
                                        className="w-6 h-6 text-blue-600"
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
                                    <div className="font-medium text-gray-900">
                                        {isResolving ? 'Resolving...' : 'Lookup remote account'}
                                    </div>
                                    <div className="text-sm text-blue-600">
                                        {results.remoteAccountSuggestion.handle}
                                    </div>
                                </div>
                            </button>
                        </div>
                    )}

                    {results.users.length === 0 &&
                        results.events.length === 0 &&
                        !results.remoteAccountSuggestion && (
                            <div className="px-4 py-8 text-center text-gray-500">
                                No results found
                            </div>
                        )}
                </div>
            )}
        </div>
    )
}
