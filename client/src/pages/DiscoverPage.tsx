import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Container } from '@/components/layout'
import { SearchFilters, type SearchFiltersState } from '@/components/SearchFilters'
import {
	GridViewIcon,
	ListViewIcon,
	Card,
	Button,
	Badge,
	ToggleGroup,
	ToggleButton,
	Select,
	Skeleton,
} from '@/components/ui'
import { useEventSearch, type EventSearchFilters, queryKeys } from '@/hooks/queries'
import { api } from '@/lib/api-client'
import { useUIStore } from '@/stores'
import type { UserProfile } from '@/types'

import { EventCard } from '../components/EventCard'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../hooks/useAuth'
import { addRecentSearch } from '../lib/recentSearches'
import { DATE_RANGE_LABELS, type DateRangeSelection } from '../lib/searchConstants'
import {
	parseCommaList,
	isoToInputDate,
	inputDateToISO,
	isBackendDateRange,
	formatDateLabel,
} from '../lib/searchUtils'

type ViewMode = 'grid' | 'list'
type SortOption = 'date' | 'popularity' | 'trending'

interface ActiveFilterChip {
	key: string
	label: string
	value: string
	removableValue?: string
}

const DEFAULT_FORM_STATE: SearchFiltersState = {
	q: '',
	location: '',
	dateRange: 'anytime',
	startDate: '',
	endDate: '',
	mode: '',
	status: '',
	categories: [],
}

// --- Helpers ---

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

const buildFormStateFromParams = (params: URLSearchParams): SearchFiltersState => {
	const categories = [
		...parseCommaList(params.get('categories')),
		...parseCommaList(params.get('tags')),
	]
	const startDateParam = params.get('startDate')
	const endDateParam = params.get('endDate')
	const dateRangeParam = params.get('dateRange') as DateRangeSelection | null

	let dateRange: DateRangeSelection = 'anytime'
	if (dateRangeParam) {
		if (isBackendDateRange(dateRangeParam) || dateRangeParam === 'anytime') {
			dateRange = dateRangeParam
		} else {
			dateRange = 'custom'
		}
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

export function DiscoverPage() {
	const limit = 20
	const { user, logout } = useAuth()
	const { sseConnected } = useUIStore()
	const [searchParams, setSearchParams] = useSearchParams()
	const [viewMode, setViewMode] = useState<ViewMode>('grid')

	// --- State & Filters ---

	const initialFormState = useMemo(() => buildFormStateFromParams(searchParams), [searchParams])
	const [filters, setFilters] = useState<SearchFiltersState>(initialFormState)

	const sortOption = useMemo<SortOption>(() => {
		const sortParam = searchParams.get('sort') as SortOption | null
		if (sortParam && ['date', 'popularity', 'trending'].includes(sortParam)) {
			return sortParam
		}
		return 'date'
	}, [searchParams])

	useEffect(() => {
		setFilters(buildFormStateFromParams(searchParams))
	}, [searchParams])

	const currentPage = Math.max(1, Number(searchParams.get('page') || '1'))

	const requestFilters = useMemo(() => {
		const reqFilters = buildRequestFilters(searchParams)
		if (sortOption) {
			reqFilters.sort = sortOption
		}
		return reqFilters
	}, [searchParams, sortOption])

	// --- Queries ---

	const { data, isLoading, isError, error, isFetching } = useEventSearch(
		requestFilters,
		currentPage,
		limit
	)

	useQuery<UserProfile | null>({
		queryKey: queryKeys.users.currentProfile(user?.id),
		queryFn: async () => {
			if (!user?.id) {
				return null
			}
			try {
				return await api.get<UserProfile>(
					'/users/me/profile',
					undefined,
					undefined,
					'Failed to fetch profile'
				)
			} catch {
				return null
			}
		},
		enabled: Boolean(user?.id),
	})

	// --- Handlers ---

	const updateSearchParams = (nextParams: URLSearchParams) => {
		if (!nextParams.get('page')) {
			nextParams.set('page', '1')
		}
		setSearchParams(nextParams, { replace: true })
	}

	const handleSubmit = () => {
		const next = new URLSearchParams()

		if (filters.q.trim()) {
			next.set('q', filters.q.trim())
			addRecentSearch(filters.q.trim())
		}
		if (filters.location.trim()) {
			next.set('location', filters.location.trim())
		}
		if (filters.mode) {
			next.set('mode', filters.mode)
		}
		if (filters.status) {
			next.set('status', filters.status)
		}

		if (filters.dateRange !== 'anytime' && filters.dateRange !== 'custom') {
			next.set('dateRange', filters.dateRange)
		} else if (filters.dateRange === 'custom') {
			const customStart = inputDateToISO(filters.startDate)
			const customEnd = inputDateToISO(filters.endDate, true)
			if (customStart) {
				next.set('startDate', customStart)
			}
			if (customEnd) {
				next.set('endDate', customEnd)
			}
		}

		if (filters.categories.length > 0) {
			next.set('categories', filters.categories.join(','))
		}

		if (sortOption !== 'date') {
			next.set('sort', sortOption)
		}

		next.set('page', '1')
		updateSearchParams(next)
		window.scrollTo({ top: 0, behavior: 'smooth' })
	}

	const handleSortChange = (newSort: string) => {
		const next = new URLSearchParams(searchParams)
		next.set('sort', newSort)
		next.set('page', '1')
		setSearchParams(next, { replace: true })
	}

	const handleClearFilters = () => {
		setFilters(DEFAULT_FORM_STATE)
		const next = new URLSearchParams()
		// Preserve sort if desired, or clear it too. Let's clear it for a full reset.
		setSearchParams(next, { replace: true })
	}

	const handlePageChange = (page: number) => {
		const next = new URLSearchParams(searchParams)
		next.set('page', String(page))
		setSearchParams(next, { replace: true })
		window.scrollTo({ top: 0, behavior: 'smooth' })
	}

	const handleRemoveActiveFilter = (chip: ActiveFilterChip) => {
		const next = new URLSearchParams(searchParams)
		if ((chip.key === 'categories' || chip.key === 'tags') && chip.removableValue) {
			const current = parseCommaList(next.get(chip.key))
			const remaining = current.filter((item) => item !== chip.removableValue)
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

	// --- Derived Data ---

	const events = data?.events || []
	const totalResults = data?.pagination.total ?? 0
	const totalPages = data?.pagination.pages ?? 0

	const activeFilterChips = useMemo<ActiveFilterChip[]>(() => {
		const chips: ActiveFilterChip[] = []
		const q = searchParams.get('q')
		if (q) {
			chips.push({ key: 'q', label: 'Keyword', value: q })
		}

		const loc = searchParams.get('location')
		if (loc) {
			chips.push({ key: 'location', label: 'Location', value: loc })
		}

		const dr = searchParams.get('dateRange') as DateRangeSelection | null
		if (dr && dr !== 'custom') {
			chips.push({
				key: 'dateRange',
				label: 'Date',
				value: DATE_RANGE_LABELS[dr] ?? dr,
			})
		}

		const start = searchParams.get('startDate')
		if (start) {
			chips.push({
				key: 'startDate',
				label: 'After',
				value: formatDateLabel(start),
			})
		}

		const end = searchParams.get('endDate')
		if (end) {
			chips.push({
				key: 'endDate',
				label: 'Before',
				value: formatDateLabel(end),
			})
		}

		const mode = searchParams.get('mode')
		if (mode) {
			chips.push({
				key: 'mode',
				label: 'Mode',
				value: mode.replace('EventAttendanceMode', ''),
			})
		}

		const status = searchParams.get('status')
		if (status) {
			chips.push({
				key: 'status',
				label: 'Status',
				value: status.replace('Event', ''),
			})
		}

		parseCommaList(searchParams.get('categories')).forEach((c) =>
			chips.push({
				key: 'categories',
				label: 'Tag',
				value: c,
				removableValue: c,
			})
		)

		return chips
	}, [searchParams])

	return (
		<div className="min-h-screen bg-background-secondary">
			<Navbar isConnected={sseConnected} user={user} onLogout={logout} />

			<Container className="py-8" size="xl">
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
					{/* Sidebar Filters */}
					<aside className="lg:col-span-3 lg:sticky lg:top-24">
						<SearchFilters
							filters={filters}
							onFiltersChange={setFilters}
							onApply={handleSubmit}
							onClear={handleClearFilters}
						/>
					</aside>

					{/* Main Content */}
					<main className="lg:col-span-9 space-y-6">
						{/* Header & Controls */}
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
							<div>
								<h1 className="text-3xl font-bold text-text-primary tracking-tight">
									Discover Events
								</h1>
								<p className="text-text-secondary mt-1">
									{isFetching ? (
										<span className="flex items-center gap-2">
											<span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
											Updating results...
										</span>
									) : (
										`${totalResults} events found`
									)}
								</p>
							</div>

							<div className="flex items-center gap-3">
								<Select
									value={sortOption}
									onChange={(e) => handleSortChange(e.target.value)}
									className="w-[160px]"
									size="sm">
									<option value="date">Date: Soonest</option>
									<option value="popularity">Popularity</option>
									<option value="trending">Trending</option>
								</Select>

								<ToggleGroup
									value={viewMode}
									onValueChange={(v) => v && setViewMode(v as ViewMode)}>
									<ToggleButton
										value="grid"
										icon={<GridViewIcon className="w-4 h-4" />}
										aria-label="Grid view"
									/>
									<ToggleButton
										value="list"
										icon={<ListViewIcon className="w-4 h-4" />}
										aria-label="List view"
									/>
								</ToggleGroup>
							</div>
						</div>

						{/* Active Filters Bar */}
						{activeFilterChips.length > 0 && (
							<div className="flex flex-wrap items-center gap-2 pb-2">
								<span className="text-sm font-medium text-text-secondary mr-1">
									Active:
								</span>
								{activeFilterChips.map((chip) => (
									<Badge
										key={`${chip.key}-${chip.value}-${chip.removableValue}`}
										variant="secondary"
										className="pl-2 pr-1 py-1">
										<span className="opacity-70 mr-1">{chip.label}:</span>
										{chip.value}
										<button
											onClick={() => handleRemoveActiveFilter(chip)}
											className="ml-1.5 hover:text-text-primary p-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
											×
										</button>
									</Badge>
								))}
								<Button
									variant="ghost"
									size="sm"
									onClick={handleClearFilters}
									className="text-xs h-7 text-primary-600 hover:text-primary-700">
									Clear All
								</Button>
							</div>
						)}

						{/* Results Grid/List */}
						<div className="min-h-[400px]">
							{isError && (
								<Card className="p-8 border-error-200 bg-error-50 dark:bg-error-900/20 dark:border-error-900">
									<div className="text-center text-error-700 dark:text-error-300">
										<p className="font-semibold">Something went wrong</p>
										<p className="text-sm mt-1">
											{(error as Error)?.message || 'Please try again later.'}
										</p>
										<Button
											variant="outline"
											size="sm"
											onClick={() => window.location.reload()}
											className="mt-4 border-error-300 text-error-700 hover:bg-error-100">
											Reload Page
										</Button>
									</div>
								</Card>
							)}

							{isLoading ? (
								<div
									className={
										viewMode === 'grid'
											? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
											: 'space-y-4'
									}>
									{Array.from({ length: 6 }).map((_, i) => (
										<div
											key={`skeleton-grid-${i}`}
											className="space-y-3 p-4 border border-border-default rounded-xl bg-background-primary">
											<Skeleton className="h-48 w-full rounded-lg" />
											<Skeleton className="h-6 w-3/4" />
											<Skeleton className="h-4 w-1/2" />
										</div>
									))}
								</div>
							) : events.length > 0 ? (
								<div
									className={
										viewMode === 'grid'
											? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
											: 'space-y-4'
									}>
									{events.map((event) => (
										<div
											key={event.id}
											className={
												viewMode === 'list' ? 'max-w-4xl mx-auto' : ''
											}>
											<EventCard
												event={event}
												variant={viewMode === 'list' ? 'compact' : 'full'}
												isAuthenticated={Boolean(user)}
											/>
										</div>
									))}
								</div>
							) : (
								!isError && (
									<Card className="py-16 px-6 text-center border-dashed">
										<div className="flex flex-col items-center justify-center max-w-sm mx-auto">
											<div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4 text-3xl">
												🔍
											</div>
											<h3 className="text-xl font-bold text-text-primary mb-2">
												No events found
											</h3>
											<p className="text-text-secondary mb-6">
												We couldn&apos;t find any events matching your
												filters. Try adjusting your search terms or browsing
												all events.
											</p>
											<Button variant="primary" onClick={handleClearFilters}>
												Clear Filters
											</Button>
										</div>
									</Card>
								)
							)}
						</div>

						{/* Pagination */}
						{totalPages > 1 && (
							<div className="flex justify-center pt-8">
								<div className="flex items-center gap-2 bg-background-primary p-2 rounded-lg border border-border-default shadow-sm">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => handlePageChange(currentPage - 1)}
										disabled={currentPage <= 1}>
										← Previous
									</Button>
									<span className="text-sm font-medium px-4 text-text-secondary">
										Page {currentPage} of {totalPages}
									</span>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => handlePageChange(currentPage + 1)}
										disabled={currentPage >= totalPages}>
										Next →
									</Button>
								</div>
							</div>
						)}
					</main>
				</div>
			</Container>
		</div>
	)
}
