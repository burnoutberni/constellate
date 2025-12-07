import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../contexts/AuthContext'
import { useUIStore } from '../stores'
import { useEventSearch, type EventSearchFilters } from '../hooks/queries'
import { queryKeys } from '../hooks/queries/keys'
import { getVisibilityMeta } from '../lib/visibility'
import { getDefaultTimezone } from '../lib/timezones'
import type { Event } from '../types'

const BACKEND_DATE_RANGES = ['today', 'tomorrow', 'this_weekend', 'next_7_days', 'next_30_days'] as const
const DATE_RANGE_LABELS: Record<string, string> = {
    anytime: 'Any time',
    custom: 'Custom range',
    today: 'Today',
    tomorrow: 'Tomorrow',
    this_weekend: 'This weekend',
    next_7_days: 'Next 7 days',
    next_30_days: 'Next 30 days',
}

type BackendDateRange = (typeof BACKEND_DATE_RANGES)[number]
type DateRangeSelection = 'anytime' | 'custom' | BackendDateRange

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
    if (!value) return ''
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
    if (!value) return undefined
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
        ...parseCommaList(params.get('tags'))
    ]
    const startDateParam = params.get('startDate')
    const endDateParam = params.get('endDate')
    const dateRangeParam = params.get('dateRange') as DateRangeSelection | null

    let dateRange: DateRangeSelection = 'anytime'
    if (dateRangeParam && (DATE_RANGE_LABELS[dateRangeParam] ?? false)) {
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

const normalizeCategory = (value: string) => value.trim().replace(/^#+/, '').trim().toLowerCase()

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

const formatEventDateTime = (isoString: string, timezone: string) => {
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) {
        return isoString
    }
    return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: timezone,
    }).format(date)
}

const dateRangeOptions: Array<{ value: DateRangeSelection; label: string }> = [
    { value: 'anytime', label: DATE_RANGE_LABELS.anytime },
    { value: 'today', label: DATE_RANGE_LABELS.today },
    { value: 'tomorrow', label: DATE_RANGE_LABELS.tomorrow },
    { value: 'this_weekend', label: DATE_RANGE_LABELS.this_weekend },
    { value: 'next_7_days', label: DATE_RANGE_LABELS.next_7_days },
    { value: 'next_30_days', label: DATE_RANGE_LABELS.next_30_days },
    { value: 'custom', label: DATE_RANGE_LABELS.custom },
]

export function SearchPage() {
    const limit = 20
    const { user, logout } = useAuth()
    const { sseConnected } = useUIStore()
    const [searchParams, setSearchParams] = useSearchParams()
    const [categoryInput, setCategoryInput] = useState('')

    const initialFormState = useMemo(() => buildFormStateFromParams(searchParams), [searchParams])
    const [formState, setFormState] = useState<FormState>(initialFormState)

    const { data: viewerProfile } = useQuery({
        queryKey: queryKeys.users.currentProfile(user?.id),
        queryFn: async () => {
            if (!user?.id) return null
            const response = await fetch('/api/users/me/profile', {
                credentials: 'include',
            })
            if (!response.ok) return null
            return response.json()
        },
        enabled: !!user?.id,
    })

    const defaultTimezone = useMemo(() => getDefaultTimezone(), [])
    const viewerTimezone = viewerProfile?.timezone || defaultTimezone

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

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault()
        const next = new URLSearchParams()

        if (formState.q.trim()) {
            next.set('q', formState.q.trim())
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

    const handleCategoryKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter' && event.key !== ',') {
            return
        }
        event.preventDefault()
        const normalized = normalizeCategory(categoryInput)
        if (!normalized) {
            return
        }
        setFormState((prev) => {
            if (prev.categories.includes(normalized)) {
                return prev
            }
            return {
                ...prev,
                categories: [...prev.categories, normalized],
            }
        })
        setCategoryInput('')
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
        setCategoryInput('')
        setSearchParams(new URLSearchParams(), { replace: true })
    }

    const handleRemoveCategory = (category: string) => {
        setFormState((prev) => ({
            ...prev,
            categories: prev.categories.filter((item) => item !== category),
        }))
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
            return data.events.map((event: Event) => <EventResultCard key={event.id} event={event} timezone={viewerTimezone} />)
        }
        return null
    }

    const totalPages = data?.pagination.pages ?? 0
    const totalResults = data?.pagination.total ?? 0

    return (
        <div className="min-h-screen bg-gray-100">
            <Navbar isConnected={sseConnected} user={user} onLogout={logout} />
            <div className="max-w-7xl mx-auto px-4 py-6 grid gap-6 lg:grid-cols-12">
                <form onSubmit={handleSubmit} className="lg:col-span-4 space-y-4">
                    <div className="card p-5 space-y-4">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Advanced Filters</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Combine multiple filters to pinpoint the exact events you want to explore.
                            </p>
                        </div>

                        <label className="form-control w-full">
                            <span className="label-text">Keyword</span>
                            <input
                                type="text"
                                value={formState.q}
                                onChange={(event) => setFormState((prev) => ({ ...prev, q: event.target.value }))}
                                placeholder="Search titles or descriptions"
                                className="input input-bordered"
                            />
                        </label>

                        <label className="form-control w-full">
                            <span className="label-text">Location</span>
                            <input
                                type="text"
                                value={formState.location}
                                onChange={(event) => setFormState((prev) => ({ ...prev, location: event.target.value }))}
                                placeholder="City, venue, or keyword"
                                className="input input-bordered"
                            />
                        </label>

                        <label className="form-control w-full">
                            <span className="label-text">Date range</span>
                            <select
                                value={formState.dateRange}
                                onChange={(event) => setFormState((prev) => ({ ...prev, dateRange: event.target.value as DateRangeSelection }))}
                                className="select select-bordered"
                            >
                                {dateRangeOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        {formState.dateRange === 'custom' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="form-control w-full">
                                    <span className="label-text">Starts after</span>
                                    <input
                                        type="date"
                                        value={formState.startDate}
                                        onChange={(event) => setFormState((prev) => ({ ...prev, startDate: event.target.value }))}
                                        className="input input-bordered"
                                    />
                                </label>
                                <label className="form-control w-full">
                                    <span className="label-text">Ends before</span>
                                    <input
                                        type="date"
                                        value={formState.endDate}
                                        onChange={(event) => setFormState((prev) => ({ ...prev, endDate: event.target.value }))}
                                        className="input input-bordered"
                                    />
                                </label>
                            </div>
                        )}

                        <label className="form-control w-full">
                            <span className="label-text">Attendance mode</span>
                            <select
                                value={formState.mode}
                                onChange={(event) => setFormState((prev) => ({ ...prev, mode: event.target.value }))}
                                className="select select-bordered"
                            >
                                <option value="">Any</option>
                                <option value="OfflineEventAttendanceMode">In person</option>
                                <option value="OnlineEventAttendanceMode">Online</option>
                                <option value="MixedEventAttendanceMode">Hybrid</option>
                            </select>
                        </label>

                        <label className="form-control w-full">
                            <span className="label-text">Status</span>
                            <select
                                value={formState.status}
                                onChange={(event) => setFormState((prev) => ({ ...prev, status: event.target.value }))}
                                className="select select-bordered"
                            >
                                <option value="">Any</option>
                                <option value="EventScheduled">Scheduled</option>
                                <option value="EventPostponed">Postponed</option>
                                <option value="EventCancelled">Cancelled</option>
                            </select>
                        </label>

                        <div className="space-y-2">
                            <label className="form-control w-full">
                                <span className="label-text">Categories / Tags</span>
                                <input
                                    type="text"
                                    value={categoryInput}
                                    onChange={(event) => setCategoryInput(event.target.value)}
                                    onKeyDown={handleCategoryKeyDown}
                                    placeholder="Press Enter to add"
                                    className="input input-bordered"
                                />
                            </label>
                            {formState.categories.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {formState.categories.map((category) => (
                                        <span key={category} className="badge badge-outline gap-2">
                                            #{category}
                                            <button
                                                type="button"
                                                aria-label={`Remove ${category}`}
                                                onClick={() => handleRemoveCategory(category)}
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button type="submit" className="btn btn-primary flex-1">
                                Apply filters
                            </button>
                            <button type="button" onClick={handleClearAllFilters} className="btn btn-ghost">
                                Clear
                            </button>
                        </div>
                    </div>
                </form>

                <div className="lg:col-span-8 space-y-4">
                    <div className="card p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900">Search Results</h2>
                                <p className="text-sm text-gray-500">
                                    {(() => {
                                        if (isFetching) return 'Updating results…'
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
                    </div>

                    <div className="space-y-4">
                        {isError && (
                            <div className="card p-6 text-red-600">
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

function EventResultCard({ event, timezone }: { event: Event; timezone: string }) {
    const eventPath = event.user?.username
        ? `/@${event.user.username}/${event.originalEventId || event.id}`
        : undefined
    const visibilityMeta = getVisibilityMeta(event.visibility)

    return (
        <div className="card p-5 space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
                    <p className="text-sm text-gray-500">
                        {formatEventDateTime(event.startTime, timezone)}
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
            </div>

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
