import { FormEvent, KeyboardEvent, useState } from 'react'
import { Card, Button, Input, Badge } from './ui'
import { Select } from './ui/Select'
import { normalizeCategory } from '../lib/searchUtils'
import { DATE_RANGE_LABELS, type DateRangeSelection } from '../lib/searchConstants'

export interface FilterFormState {
	q: string
	location: string
	dateRange: DateRangeSelection
	startDate: string
	endDate: string
	mode: string
	status: string
	categories: string[]
}

interface EventFiltersProps {
	formState: FilterFormState
	onFormStateChange: (state: FilterFormState) => void
	onSubmit: (event: FormEvent) => void
	onClearAll: () => void
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

export function EventFilters({
	formState,
	onFormStateChange,
	onSubmit,
	onClearAll,
}: EventFiltersProps) {
	const [categoryInput, setCategoryInput] = useState('')

	const handleCategoryKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key !== 'Enter' && event.key !== ',') {
			return
		}
		event.preventDefault()
		const normalized = normalizeCategory(categoryInput)
		if (!normalized) {
			return
		}
		if (formState.categories.includes(normalized)) {
			setCategoryInput('')
			return
		}
		onFormStateChange({
			...formState,
			categories: [...formState.categories, normalized],
		})
		setCategoryInput('')
	}

	const handleRemoveCategory = (category: string) => {
		onFormStateChange({
			...formState,
			categories: formState.categories.filter((item) => item !== category),
		})
	}

	return (
		<form onSubmit={onSubmit}>
			<Card className="p-5 space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-neutral-900">Filters</h2>
					<p className="text-sm text-neutral-500 mt-1">
						Find events that match your interests
					</p>
				</div>

				<div>
					<label
						htmlFor="keyword-filter"
						className="block text-sm font-medium text-neutral-700 mb-1">
						Keyword
					</label>
					<Input
						id="keyword-filter"
						type="text"
						value={formState.q}
						onChange={(event) =>
							onFormStateChange({ ...formState, q: event.target.value })
						}
						placeholder="Search titles or descriptions"
					/>
				</div>

				<div>
					<label
						htmlFor="location-filter"
						className="block text-sm font-medium text-neutral-700 mb-1">
						Location
					</label>
					<Input
						id="location-filter"
						type="text"
						value={formState.location}
						onChange={(event) =>
							onFormStateChange({ ...formState, location: event.target.value })
						}
						placeholder="City, venue, or keyword"
					/>
				</div>

				<div>
					<Select
						id="date-range-filter"
						label="Date range"
						value={formState.dateRange}
						onChange={(event) =>
							onFormStateChange({
								...formState,
								dateRange: event.target.value as DateRangeSelection,
							})
						}>
						{dateRangeOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</Select>
				</div>

				{formState.dateRange === 'custom' && (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label
								htmlFor="start-date-filter"
								className="block text-sm font-medium text-neutral-700 mb-1">
								Starts after
							</label>
							<Input
								id="start-date-filter"
								type="date"
								value={formState.startDate}
								onChange={(event) =>
									onFormStateChange({
										...formState,
										startDate: event.target.value,
									})
								}
							/>
						</div>
						<div>
							<label
								htmlFor="end-date-filter"
								className="block text-sm font-medium text-neutral-700 mb-1">
								Ends before
							</label>
							<Input
								id="end-date-filter"
								type="date"
								value={formState.endDate}
								onChange={(event) =>
									onFormStateChange({ ...formState, endDate: event.target.value })
								}
							/>
						</div>
					</div>
				)}

				<div>
					<Select
						id="mode-filter"
						label="Attendance mode"
						value={formState.mode}
						onChange={(event) =>
							onFormStateChange({ ...formState, mode: event.target.value })
						}>
						<option value="">Any</option>
						<option value="OfflineEventAttendanceMode">In person</option>
						<option value="OnlineEventAttendanceMode">Online</option>
						<option value="MixedEventAttendanceMode">Hybrid</option>
					</Select>
				</div>

				<div>
					<Select
						id="status-filter"
						label="Status"
						value={formState.status}
						onChange={(event) =>
							onFormStateChange({ ...formState, status: event.target.value })
						}>
						<option value="">Any</option>
						<option value="EventScheduled">Scheduled</option>
						<option value="EventPostponed">Postponed</option>
						<option value="EventCancelled">Cancelled</option>
					</Select>
				</div>

				<div className="space-y-2">
					<label
						htmlFor="categories-filter"
						className="block text-sm font-medium text-neutral-700">
						Categories / Tags
					</label>
					<Input
						id="categories-filter"
						type="text"
						value={categoryInput}
						onChange={(event) => setCategoryInput(event.target.value)}
						onKeyDown={handleCategoryKeyDown}
						placeholder="Press Enter to add"
					/>
					{formState.categories.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{formState.categories.map((category) => (
								<Badge key={category} variant="default">
									#{category}
									<Button
										type="button"
										aria-label={`Remove ${category}`}
										onClick={() => handleRemoveCategory(category)}
										variant="ghost"
										size="sm"
										className="ml-1 text-neutral-500 hover:text-neutral-700 h-auto p-0 min-w-0">
										×
									</Button>
								</Badge>
							))}
						</div>
					)}
				</div>

				<div className="flex gap-3 pt-2">
					<Button type="submit" variant="primary" className="flex-1">
						Apply filters
					</Button>
					<Button type="button" onClick={onClearAll} variant="secondary">
						Clear
					</Button>
				</div>
			</Card>
		</form>
	)
}
