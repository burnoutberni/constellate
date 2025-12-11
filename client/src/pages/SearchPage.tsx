import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Navbar } from '../components/Navbar'
import { Stack } from '@/components/layout'
import { useAuth } from '../hooks/useAuth'
import { useUIStore } from '@/stores'
import { useEventSearch, type EventSearchFilters, queryKeys } from '@/hooks/queries'
import { getVisibilityMeta } from '../lib/visibility'
import { getDefaultTimezone } from '../lib/timezones'
import type { Event } from '@/types'
import { AdvancedSearchFilters } from '../components/AdvancedSearchFilters'
import { addRecentSearch } from '../lib/recentSearches'
import { TrendingEvents } from '../components/TrendingEvents'
import { RecommendedEvents } from '../components/RecommendedEvents'
import { DATE_RANGE_LABELS, type DateRangeSelection } from '../lib/searchConstants'
import { isBackendDateRange } from '../lib/searchUtils'

interface FormState {
    q: string
    location: string
    dateRange: DateRangeSelection
    startDate: string
    endDate: string
    mode: string
    status: string
    categories: string[]
}

interface ActiveFilterChip {
    key: string
    label: string
    value: string
    removableValue?: string
}

const DEFAULT_FORM_STATE: FormState = {
    q: '',
    location: '',
    dateRange: 'anytime',
    startDate: '',
    endDate: '',
    mode: '',
    status: '',
    categories: [],
}

const parseCommaList = (value?: string | null) =>
    value
        ? value
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
        : []

const isoToInputDate = (value?: string | null) => {
    if (!value) {
return ''
}
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return ''
    }
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

const inputDateToISO = (value: string, endOfDay = false) => {
    if (!value) {
return undefined
}
    const [yearStr, monthStr, dayStr] = value.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr)
    const day = Number(dayStr)

    if (!year || !month || !day) {
        return undefined
    }

    const hours = endOfDay ? 23 : 0
    const minutes = endOfDay ? 59 : 0
    const seconds = endOfDay ? 59 : 0
    const millis = endOfDay ? 999 : 0

    const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, millis))
    return date.toISOString()
}

const buildRequestFilters = (params: URLSearchParams): EventSearchFilters => {
    const filters: EventSearchFilters = {}
    const keys: Array<keyof EventSearchFilters> = ['q', 'location', 'startDate', 'endDate', 'dateRange', 'status', 'mode', 'username', 'tags', 'categories']

    keys.forEach((key) => {
        const value = params.get(key as string)
        if (value) {
            filters[key] = value
        }
    })

    return filters
}

const buildFormStateFromParams = (params: URLSearchParams): FormState => {
    const categories = [
        ...parseCommaList(params.get('categories')),
        ...parseCommaList(params.get('tags')),
    ]
    const startDateParam = params.get('startDate')
    const endDateParam = params.get('endDate')
    const dateRangeParam = params.get('dateRange') as DateRangeSelection | null

    let dateRange: DateRangeSelection = 'anytime'
    if (dateRangeParam && (isBackendDateRange(dateRangeParam) || dateRangeParam === 'anytime' || dateRangeParam === 'custom')) {
        dateRange = dateRangeParam
    } else if (startDateParam || endDateParam) {
        dateRange = 'custom'
    }

    return {
        q: params.get('q') ?? '',
        location: params.get('location') ?? '',
        dateRange,
        startDate: isoToInputDate(startDateParam),
        endDate: isoToInputDate(endDateParam),
        mode: params.get('mode') ?? '',
        status: params.get('status') ?? '',
        categories,
    }
}

const formatDateLabel = (isoString: string) => {
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) {
        return isoString
    }
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
}

// Memoized formatter factory to avoid creating new Intl.DateTimeFormat instances on every call
const createEventDateTimeFormatter = (timezone: string) => new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: timezone,
    })

// Format event date/time - formatter should be memoized at component level for performance
const formatEventDateTime = (isoString: string, formatter: Intl.DateTimeFormat) => {
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) {
        return isoString
    }
    return formatter.format(date)
}

export function SearchPage() {
    const limit = 20
    const { user, logout } = useAuth()
    const { sseConnected } = useUIStore()
    const [searchParams, setSearchParams] = useSearchParams()

    const initialFormState = useMemo(() => buildFormStateFromParams(searchParams), [searchParams])
    const [formState, setFormState] = useState<FormState>(initialFormState)

    const { data: viewerProfile } = useQuery({
        queryKey: queryKeys.users.currentProfile(user?.id),
        queryFn: async () => {
            if (!user?.id) {
return null
}
            const response = await fetch('/api/users/me/profile', {
                credentials: 'include',
            })
            if (!response.ok) {
return null
}
            return response.json()
        },
        enabled: Boolean(user?.id),
    })

    const defaultTimezone = useMemo(() => getDefaultTimezone(), [])
    const viewerTimezone = viewerProfile?.timezone || defaultTimezone

    // Memoize the date/time formatter to avoid creating new instances on every render
    const eventDateTimeFormatter = useMemo(
        () => createEventDateTimeFormatter(viewerTimezone),
        [viewerTimezone],
    )

    useEffect(() => {
        setFormState(buildFormStateFromParams(searchParams))
    }, [searchParams])

    const currentPage = Math.max(1, Number(searchParams.get('page') || '1'))
    const requestFilters = useMemo(() => buildRequestFilters(searchParams), [searchParams])

    const { data, isLoading, isError, error, isFetching } = useEventSearch(requestFilters, currentPage, limit)

    const appliedFilters = useMemo<ActiveFilterChip[]>(() => {
        const chips: ActiveFilterChip[] = []
        const q = searchParams.get('q')
        if (q) {
            chips.push({ key: 'q', label: 'Keyword', value: q })
        }

        const location = searchParams.get('location')
        if (location) {
            chips.push({ key: 'location', label: 'Location', value: location })
        }

        const dateRange = searchParams.get('dateRange') as DateRangeSelection | null
        if (dateRange && dateRange !== 'custom') {
            chips.push({ key: 'dateRange', label: 'Date', value: DATE_RANGE_LABELS[dateRange] ?? dateRange })
        }

        const startDate = searchParams.get('startDate')
        if (startDate) {
            chips.push({ key: 'startDate', label: 'Starts after', value: formatDateLabel(startDate) })
        }

        const endDate = searchParams.get('endDate')
        if (endDate) {
            chips.push({ key: 'endDate', label: 'Ends before', value: formatDateLabel(endDate) })
        }

        const mode = searchParams.get('mode')
        if (mode) {
            chips.push({ key: 'mode', label: 'Attendance', value: mode.replace('EventAttendanceMode', '') })
        }

        const status = searchParams.get('status')
        if (status) {
            chips.push({ key: 'status', label: 'Status', value: status.replace('Event', '') })
        }

        parseCommaList(searchParams.get('categories')).forEach((category) => {
            chips.push({ key: 'categories', label: 'Category', value: `#${category}`, removableValue: category })
        })

        parseCommaList(searchParams.get('tags')).forEach((tag) => {
            chips.push({ key: 'tags', label: 'Tag', value: `#${tag}`, removableValue: tag })
        })

        return chips
    }, [searchParams])

    const updateSearchParams = (nextParams: URLSearchParams) => {
        if (!nextParams.get('page')) {
            nextParams.set('page', '1')
        }
        setSearchParams(nextParams, { replace: true })
    }

    const handleSubmit = (event?: FormEvent) => {
        event?.preventDefault()
        const next = new URLSearchParams()

        if (formState.q.trim()) {
            next.set('q', formState.q.trim())
            // Add to recent searches
            addRecentSearch(formState.q.trim())
        }

        if (formState.location.trim()) {
            next.set('location', formState.location.trim())
        }

        if (formState.mode) {
            next.set('mode', formState.mode)
        }

        if (formState.status) {
            next.set('status', formState.status)
        }

        if (formState.dateRange !== 'anytime' && formState.dateRange !== 'custom') {
            next.set('dateRange', formState.dateRange)
        }

        if (formState.dateRange === 'custom') {
            const customStart = inputDateToISO(formState.startDate)
            const customEnd = inputDateToISO(formState.endDate, true)
            if (customStart) {
                next.set('startDate', customStart)
            }
            if (customEnd) {
                next.set('endDate', customEnd)
            }
        }

        if (formState.categories.length > 0) {
            next.set('categories', formState.categories.join(','))
        }

        next.set('page', '1')
        updateSearchParams(next)
    }

    const handleRemoveFilter = (chip: ActiveFilterChip) => {
        const next = new URLSearchParams(searchParams)
        if ((chip.key === 'categories' || chip.key === 'tags') && chip.removableValue) {
            const remaining = parseCommaList(next.get(chip.key)).filter((item) => item !== chip.removableValue)
            if (remaining.length > 0) {
                next.set(chip.key, remaining.join(','))
            } else {
                next.delete(chip.key)
            }
        } else {
            next.delete(chip.key)
        }
        next.delete('page')
        updateSearchParams(next)
    }

    const handleClearAllFilters = () => {
        setFormState(DEFAULT_FORM_STATE)
        setSearchParams(new URLSearchParams(), { replace: true })
    }

    const handlePageChange = (page: number) => {
        const nextPage = Math.max(1, page)
        const next = new URLSearchParams(searchParams)
        next.set('page', String(nextPage))
        setSearchParams(next, { replace: true })
    }

    const renderEventResults = () => {
        if (isLoading) {
            return (
                <div className="card p-10 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mx-auto" />
                    <p className="text-sm text-gray-500 mt-3">Looking for matching events…</p>
                </div>
            )
        }
        if (data && data.events && data.events.length === 0) {
            return (
                <div className="card p-10 text-center text-gray-500">
                    <p className="font-medium">No events match these filters just yet.</p>
                    <p className="text-sm mt-2">Try broadening your date range or removing a location filter.</p>
                </div>
            )
        }
        if (data?.events) {
            return data.events.map((event: Event) => <EventResultCard key={event.id} event={event} formatter={eventDateTimeFormatter} />)
        }
        return null
    }

    const totalPages = data?.pagination.pages ?? 0
    const totalResults = data?.pagination.total ?? 0

    return (
        <div className="min-h-screen bg-gray-100">
            <Navbar isConnected={sseConnected} user={user} onLogout={logout} />
            <div className="max-w-7xl mx-auto px-4 py-6 grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-4 space-y-4">
                    <AdvancedSearchFilters
                        filters={formState}
                        onFiltersChange={setFormState}
                        onApply={() => handleSubmit()}
                        onClear={handleClearAllFilters}
                    />

                    {/* Trending Events Sidebar */}
                    {!user && (
                        <TrendingEvents limit={5} windowDays={7} />
                    )}

                    {/* Recommended Events Sidebar */}
                    {user && (
                        <RecommendedEvents limit={5} />
                    )}
                </div>

                <div className="lg:col-span-8 space-y-4">
                    <Stack className="card p-4" gap="sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900">Search Results</h2>
                                <p className="text-sm text-gray-500">
                                    {(() => {
                                        if (isFetching) {
return 'Updating results…'
}
                                        const eventText = totalResults === 1 ? 'event' : 'events'
                                        return `${totalResults} ${eventText} found`
                                    })()}
                                </p>
                            </div>
                            {appliedFilters.length > 0 && (
                                <button className="btn btn-link text-sm" onClick={handleClearAllFilters}>
                                    Clear all filters
                                </button>
                            )}
                        </div>

                        {appliedFilters.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {appliedFilters.map((chip) => (
                                    <button
                                        key={`${chip.key}-${chip.value}-${chip.removableValue ?? 'all'}`}
                                        type="button"
                                        onClick={() => handleRemoveFilter(chip)}
                                        className="badge badge-outline gap-2"
                                    >
                                        <span className="text-xs uppercase text-gray-500">{chip.label}</span>
                                        <span>{chip.value}</span>
                                        <span aria-hidden="true">×</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </Stack>

                    <div className="space-y-4">
                        {isError && (
                            <div className="card p-6 text-error-600">
                                {(error as Error)?.message || 'Something went wrong while searching.'}
                            </div>
                        )}

                        {renderEventResults()}
                    </div>

                    {totalPages > 1 && (
                        <div className="card p-4 flex items-center justify-between">
                            <button
                                className="btn btn-secondary"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage <= 1}
                            >
                                Previous
                            </button>
                            <span className="text-sm text-gray-600">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage >= totalPages}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function EventResultCard({ event, formatter }: { event: Event; formatter: Intl.DateTimeFormat }) {
    const eventPath = event.user?.username
        ? `/@${event.user.username}/${event.originalEventId || event.id}`
        : undefined
    const visibilityMeta = getVisibilityMeta(event.visibility)

    return (
        <div className="card p-5 space-y-3">
            <Stack direction="column" directionMd="row" alignMd="center" justifyMd="between" gap="sm">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
                    <p className="text-sm text-gray-500">
                        {formatEventDateTime(event.startTime, formatter)}
                        {event.location && <span> • {event.location}</span>}
                    </p>
                    {event.user && (
                        <p className="text-xs text-gray-500">Hosted by @{event.user.username}</p>
                    )}
                </div>
                <div className="flex gap-2 flex-wrap">
                    <span className={`badge ${visibilityMeta.badgeClass}`}>{visibilityMeta.icon} {visibilityMeta.label}</span>
                    {event.eventStatus && (
                        <span className="badge badge-outline">{event.eventStatus.replace('Event', '')}</span>
                    )}
                    {event.eventAttendanceMode && (
                        <span className="badge badge-outline">{event.eventAttendanceMode.replace('EventAttendanceMode', '')}</span>
                    )}
                </div>
            </Stack>

            {event.summary && (
                <p className="text-sm text-gray-700 line-clamp-3">{event.summary}</p>
            )}

            {event.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {event.tags.map((tag) => (
                        <span key={tag.id} className="badge badge-outline">
                            #{tag.tag}
                        </span>
                    ))}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                {typeof event._count?.attendance === 'number' && (
                    <span>👥 {event._count.attendance} attending</span>
                )}
                {typeof event._count?.likes === 'number' && <span>❤️ {event._count.likes} likes</span>}
                {typeof event._count?.comments === 'number' && <span>💬 {event._count.comments} comments</span>}
            </div>

            {eventPath && (
                <div>
                    <Link to={eventPath} className="btn btn-primary">
                        View event
                    </Link>
                </div>
            )}
        </div>
    )
}
