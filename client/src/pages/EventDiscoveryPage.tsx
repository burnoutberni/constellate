import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { EventCard } from '../components/EventCard'
import { EventFilters, type FilterFormState } from '../components/EventFilters'
import { DATE_RANGE_LABELS, type DateRangeSelection } from '../lib/searchConstants'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { ToggleGroup, ToggleButton } from '../components/ui/ToggleGroup'
import { Select } from '../components/ui/Select'
import { Container } from '../components/layout/Container'
import { Grid } from '../components/layout/Grid'
import { useAuth } from '../contexts/AuthContext'
import { useUIStore } from '../stores'
import { useEventSearch, type EventSearchFilters } from '../hooks/queries'
import { GridViewIcon, ListViewIcon } from '../components/icons'
import { 
    parseCommaList, 
    isoToInputDate, 
    inputDateToISO, 
    isBackendDateRange, 
    formatDateLabel 
} from '../lib/searchUtils'

type ViewMode = 'grid' | 'list'
type SortOption = 'date' | 'trending' | 'popularity'

const DEFAULT_FORM_STATE: FilterFormState = {
    q: '',
    location: '',
    dateRange: 'anytime',
    startDate: '',
    endDate: '',
    mode: '',
    status: '',
    categories: [],
}

const buildRequestFilters = (params: URLSearchParams): EventSearchFilters => {
    const filters: EventSearchFilters = {}
    const keys: Array<keyof EventSearchFilters> = [
        'q',
        'location',
        'startDate',
        'endDate',
        'dateRange',
        'status',
        'mode',
        'username',
        'tags',
        'categories',
        'sort',
    ]

    keys.forEach((key) => {
        const value = params.get(key as string)
        if (value) {
            filters[key] = value
        }
    })

    return filters
}

const buildFormStateFromParams = (params: URLSearchParams): FilterFormState => {
    const categories = [...parseCommaList(params.get('categories')), ...parseCommaList(params.get('tags'))]
    const startDateParam = params.get('startDate')
    const endDateParam = params.get('endDate')
    const dateRangeParam = params.get('dateRange') as DateRangeSelection | null

    let dateRange: DateRangeSelection = 'anytime'
    if (
        dateRangeParam &&
        (isBackendDateRange(dateRangeParam) || dateRangeParam === 'anytime' || dateRangeParam === 'custom')
    ) {
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

interface ActiveFilterChip {
    key: string
    label: string
    value: string
    removableValue?: string
}

export function EventDiscoveryPage() {
    const limit = 20
    const { user, logout } = useAuth()
    const { sseConnected } = useUIStore()
    const [searchParams, setSearchParams] = useSearchParams()
    const [viewMode, setViewMode] = useState<ViewMode>('grid')

    const initialFormState = useMemo(() => buildFormStateFromParams(searchParams), [searchParams])
    const [formState, setFormState] = useState<FilterFormState>(initialFormState)

    // Derive sortOption directly from searchParams
    const sortOption = useMemo<SortOption>(() => {
        const sortParam = searchParams.get('sort') as SortOption | null
        if (sortParam && ['date', 'popularity', 'trending'].includes(sortParam)) {
            return sortParam
        }
        return 'date'
    }, [searchParams])

    useEffect(() => {
        setFormState(buildFormStateFromParams(searchParams))
    }, [searchParams])

    const currentPage = Math.max(1, Number(searchParams.get('page') || '1'))
    const requestFilters = useMemo(() => {
        const filters = buildRequestFilters(searchParams)
        // Add sort to filters if it's set
        if (sortOption) {
            filters.sort = sortOption
        }
        return filters
    }, [searchParams, sortOption])

    const { data, isLoading, isError, error, isFetching } = useEventSearch(requestFilters, currentPage, limit)

    // Events are now sorted on the server, so use them directly
    const sortedEvents = data?.events || []

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
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const totalPages = data?.pagination.pages ?? 0
    const totalResults = data?.pagination.total ?? 0

    return (
        <div className="min-h-screen bg-background-secondary">
            <Navbar isConnected={sseConnected} user={user} onLogout={logout} />
            
            <Container className="py-6">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Discover Events</h1>
                    <p className="text-gray-600">
                        Browse upcoming events from the federated community
                    </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-12">
                    {/* Filters Sidebar */}
                    <div className="lg:col-span-4">
                        <EventFilters
                            formState={formState}
                            onFormStateChange={setFormState}
                            onSubmit={handleSubmit}
                            onClearAll={handleClearAllFilters}
                        />
                    </div>

                    {/* Results Area */}
                    <div className="lg:col-span-8 space-y-4">
                        {/* Results Header */}
                        <Card className="p-4">
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div>
                                        <h2 className="text-xl font-semibold text-gray-900">
                                            {(() => {
                                                if (isFetching) return 'Updating results…'
                                                const eventText = totalResults === 1 ? 'event' : 'events'
                                                return `${totalResults} ${eventText} found`
                                            })()}
                                        </h2>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* Sort Selector */}
                                        <Select
                                            value={sortOption}
                                            onChange={(e) => {
                                                const newSort = e.target.value as SortOption
                                                // Update URL params to reflect sort change
                                                const next = new URLSearchParams(searchParams)
                                                next.set('sort', newSort)
                                                next.set('page', '1') // Reset to first page when sorting changes
                                                setSearchParams(next, { replace: true })
                                            }}
                                            size="sm"
                                            aria-label="Sort events"
                                        >
                                            <option value="date">By Date</option>
                                            <option value="popularity">By Popularity</option>
                                            <option value="trending">Trending</option>
                                        </Select>

                                        {/* View Toggle */}
                                        <ToggleGroup value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
                                            <ToggleButton
                                                value="grid"
                                                aria-label="Grid view"
                                                icon={<GridViewIcon />}
                                            />
                                            <ToggleButton
                                                value="list"
                                                aria-label="List view"
                                                icon={<ListViewIcon />}
                                            />
                                        </ToggleGroup>
                                    </div>
                                </div>

                                {/* Active Filters */}
                                {appliedFilters.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {appliedFilters.map((chip) => (
                                            <Badge
                                                key={`${chip.key}-${chip.value}-${chip.removableValue ?? 'all'}`}
                                                variant="default"
                                            >
                                                <span className="text-xs uppercase text-gray-500">{chip.label}</span>
                                                <span className="mx-1">{chip.value}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveFilter(chip)}
                                                    className="ml-1 text-gray-500 hover:text-gray-700"
                                                    aria-label={`Remove ${chip.label} filter`}
                                                >
                                                    ×
                                                </button>
                                            </Badge>
                                        ))}
                                        <button
                                            onClick={handleClearAllFilters}
                                            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                                        >
                                            Clear all
                                        </button>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Results */}
                        {isError && (
                            <Card className="p-6 text-red-600">
                                {(error as Error)?.message || 'Something went wrong while searching.'}
                            </Card>
                        )}

                        {isLoading && (
                            <Card className="p-10 text-center">
                                <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mx-auto" />
                                <p className="text-sm text-gray-500 mt-3">Looking for matching events…</p>
                            </Card>
                        )}
                        
                        {!isLoading && sortedEvents.length === 0 && (
                            <Card className="p-10 text-center text-gray-500">
                                <p className="font-medium">No events match these filters just yet.</p>
                                <p className="text-sm mt-2">
                                    Try broadening your date range or removing a location filter.
                                </p>
                            </Card>
                        )}
                        
                        {!isLoading && sortedEvents.length > 0 && viewMode === 'grid' && (
                            <Grid cols={1} colsMd={2} gap="md">
                                {sortedEvents.map((event) => (
                                    <EventCard
                                        key={event.id}
                                        event={event}
                                        variant="full"
                                        isAuthenticated={!!user}
                                    />
                                ))}
                            </Grid>
                        )}
                        
                        {!isLoading && sortedEvents.length > 0 && viewMode === 'list' && (
                            <div className="space-y-4">
                                {sortedEvents.map((event) => (
                                    <EventCard
                                        key={event.id}
                                        event={event}
                                        variant="full"
                                        isAuthenticated={!!user}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <Card className="p-4 flex items-center justify-between">
                                <Button
                                    variant="secondary"
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage <= 1}
                                >
                                    Previous
                                </Button>
                                <span className="text-sm text-gray-600">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <Button
                                    variant="secondary"
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage >= totalPages}
                                >
                                    Next
                                </Button>
                            </Card>
                        )}
                    </div>
                </div>
            </Container>
        </div>
    )
}
