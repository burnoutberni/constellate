import { useState, KeyboardEvent, type ReactNode } from 'react'

import { DATE_RANGE_LABELS, type DateRangeSelection } from '../lib/searchConstants'

import { Button, Input, Badge, Select, ChevronDownIcon, Card } from './ui'

export interface SearchFiltersState {
	q: string
	location: string
	dateRange: DateRangeSelection
	startDate: string
	endDate: string
	mode: string
	status: string
	categories: string[]
}

interface SearchFiltersProps {
	filters: SearchFiltersState
	onFiltersChange: (filters: SearchFiltersState) => void
	onApply: () => void
	onClear: () => void
	className?: string
}

const DATE_RANGE_OPTIONS: Array<{ value: DateRangeSelection; label: string }> = [
	{ value: 'anytime', label: DATE_RANGE_LABELS.anytime },
	{ value: 'today', label: DATE_RANGE_LABELS.today },
	{ value: 'tomorrow', label: DATE_RANGE_LABELS.tomorrow },
	{ value: 'this_weekend', label: DATE_RANGE_LABELS.this_weekend },
	{ value: 'next_7_days', label: DATE_RANGE_LABELS.next_7_days },
	{ value: 'next_30_days', label: DATE_RANGE_LABELS.next_30_days },
	{ value: 'custom', label: DATE_RANGE_LABELS.custom },
]

const ATTENDANCE_MODE_OPTIONS = [
	{ value: '', label: 'Any Mode' },
	{ value: 'OfflineEventAttendanceMode', label: 'In Person' },
	{ value: 'OnlineEventAttendanceMode', label: 'Online' },
	{ value: 'MixedEventAttendanceMode', label: 'Hybrid' },
] as const

const STATUS_OPTIONS = [
	{ value: '', label: 'Any Status' },
	{ value: 'EventScheduled', label: 'Scheduled' },
	{ value: 'EventPostponed', label: 'Postponed' },
	{ value: 'EventCancelled', label: 'Cancelled' },
] as const

/**
 * SearchFilters component - Consolidated filter sidebar for the discovery page.
 * Uses the new visual system for a clean, modern look.
 */
export function SearchFilters({
	filters,
	onFiltersChange,
	onApply,
	onClear,
	className,
}: SearchFiltersProps) {
	const [categoryInput, setCategoryInput] = useState('')
	const [expandedSections, setExpandedSections] = useState({
		basic: true,
		date: true,
		details: true,
		categories: true,
	})

	const toggleSection = (section: keyof typeof expandedSections) => {
		setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
	}

	const handleCategoryKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key !== 'Enter' && event.key !== ',') {
			return
		}

		event.preventDefault()
		const normalized = categoryInput.trim().replace(/^#+/, '').toLowerCase()
		if (!normalized) {
			return
		}

		if (!filters.categories.includes(normalized)) {
			onFiltersChange({
				...filters,
				categories: [...filters.categories, normalized],
			})
		}
		setCategoryInput('')
	}

	const handleRemoveCategory = (category: string) => {
		onFiltersChange({
			...filters,
			categories: filters.categories.filter((c) => c !== category),
		})
	}

	const activeFiltersCount = [
		filters.q,
		filters.location,
		filters.dateRange !== 'anytime' ? filters.dateRange : '',
		filters.startDate,
		filters.endDate,
		filters.mode,
		filters.status,
		...filters.categories,
	].filter(Boolean).length

	return (
		<div className={className}>
			<Card className="border border-border-default shadow-sm overflow-hidden" padding="none">
				<div className="p-4 border-b border-border-default bg-background-secondary/50">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-lg font-bold text-text-primary">Filters</h2>
							<p className="text-xs text-text-secondary mt-0.5">
								{activeFiltersCount === 0
									? 'Refine your search'
									: `${activeFiltersCount} active ${activeFiltersCount === 1 ? 'filter' : 'filters'}`}
							</p>
						</div>
						{activeFiltersCount > 0 && (
							<Button
								variant="ghost"
								size="sm"
								onClick={onClear}
								className="text-xs h-8 px-2 text-text-tertiary hover:text-text-primary">
								Reset
							</Button>
						)}
					</div>
				</div>

				<div className="divide-y divide-border-default">
					{/* Basic Search Section */}
					<FilterSection
						title="Keywords & Location"
						expanded={expandedSections.basic}
						onToggle={() => toggleSection('basic')}>
						<div className="space-y-3">
							<Input
								label="Keyword"
								type="text"
								value={filters.q}
								onChange={(e) => onFiltersChange({ ...filters, q: e.target.value })}
								placeholder="Search events..."
								size="sm"
							/>

							<Input
								label="Location"
								type="text"
								value={filters.location}
								onChange={(e) =>
									onFiltersChange({ ...filters, location: e.target.value })
								}
								placeholder="City, venue, or online"
								size="sm"
							/>
						</div>
					</FilterSection>

					{/* Date Range Section */}
					<FilterSection
						title="Date & Time"
						expanded={expandedSections.date}
						onToggle={() => toggleSection('date')}>
						<div className="space-y-3">
							<Select
								label="When"
								value={filters.dateRange}
								onChange={(e) =>
									onFiltersChange({
										...filters,
										dateRange: e.target.value as DateRangeSelection,
									})
								}
								size="sm">
								{DATE_RANGE_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</Select>

							{filters.dateRange === 'custom' && (
								<div className="grid grid-cols-2 gap-2 animate-fade-in">
									<Input
										label="From"
										type="date"
										value={filters.startDate}
										onChange={(e) =>
											onFiltersChange({
												...filters,
												startDate: e.target.value,
											})
										}
										size="sm"
									/>
									<Input
										label="Until"
										type="date"
										value={filters.endDate}
										onChange={(e) =>
											onFiltersChange({ ...filters, endDate: e.target.value })
										}
										size="sm"
									/>
								</div>
							)}
						</div>
					</FilterSection>

					{/* Event Details Section */}
					<FilterSection
						title="Event Type"
						expanded={expandedSections.details}
						onToggle={() => toggleSection('details')}>
						<div className="space-y-3">
							<Select
								label="Attendance"
								value={filters.mode}
								onChange={(e) =>
									onFiltersChange({ ...filters, mode: e.target.value })
								}
								size="sm">
								{ATTENDANCE_MODE_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</Select>

							<Select
								label="Status"
								value={filters.status}
								onChange={(e) =>
									onFiltersChange({ ...filters, status: e.target.value })
								}
								size="sm">
								{STATUS_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</Select>
						</div>
					</FilterSection>

					{/* Categories Section */}
					<FilterSection
						title="Tags"
						expanded={expandedSections.categories}
						onToggle={() => toggleSection('categories')}>
						<div className="space-y-3">
							<Input
								label="Add Tag"
								type="text"
								value={categoryInput}
								onChange={(e) => setCategoryInput(e.target.value)}
								onKeyDown={handleCategoryKeyDown}
								placeholder="Type and press Enter"
								size="sm"
							/>

							{filters.categories.length > 0 ? (
								<div className="flex flex-wrap gap-1.5 pt-1">
									{filters.categories.map((category) => (
										<Badge key={category} variant="primary" size="sm">
											#{category}
											<button
												type="button"
												onClick={() => handleRemoveCategory(category)}
												className="ml-1.5 hover:text-primary-900 dark:hover:text-white focus:outline-none"
												aria-label={`Remove ${category}`}>
												×
											</button>
										</Badge>
									))}
								</div>
							) : (
								<p className="text-xs text-text-tertiary italic">
									No tags selected
								</p>
							)}
						</div>
					</FilterSection>
				</div>

				<div className="p-4 bg-background-secondary/30 border-t border-border-default">
					<Button variant="primary" fullWidth onClick={onApply}>
						Show Results
					</Button>
				</div>
			</Card>
		</div>
	)
}

interface FilterSectionProps {
	title: string
	expanded: boolean
	onToggle: () => void
	children: ReactNode
}

function FilterSection({ title, expanded, onToggle, children }: FilterSectionProps) {
	return (
		<div className="bg-background-primary">
			<button
				type="button"
				onClick={onToggle}
				className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-background-secondary/50 transition-colors focus:outline-none focus-visible:bg-background-secondary">
				<span className="text-sm font-semibold text-text-primary">{title}</span>
				<ChevronDownIcon
					className={`w-4 h-4 text-text-tertiary transition-transform duration-200 ${
						expanded ? 'rotate-180' : ''
					}`}
				/>
			</button>
			{expanded && <div className="px-4 pb-4 animate-slide-down">{children}</div>}
		</div>
	)
}
