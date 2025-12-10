import { FormEvent, KeyboardEvent, useState } from 'react'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Badge } from './ui/Badge'

export const DATE_RANGE_LABELS: Record<string, string> = {
    anytime: 'Any time',
    custom: 'Custom range',
    today: 'Today',
    tomorrow: 'Tomorrow',
    this_weekend: 'This weekend',
    next_7_days: 'Next 7 days',
    next_30_days: 'Next 30 days',
}

export const BACKEND_DATE_RANGES = ['today', 'tomorrow', 'this_weekend', 'next_7_days', 'next_30_days'] as const
export type BackendDateRange = (typeof BACKEND_DATE_RANGES)[number]
export type DateRangeSelection = 'anytime' | 'custom' | BackendDateRange

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

const normalizeCategory = (value: string) => value.trim().replace(/^#+/, '').trim().toLowerCase()

export function EventFilters({ formState, onFormStateChange, onSubmit, onClearAll }: EventFiltersProps) {
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
                    <h2 className="text-xl font-semibold text-gray-900">Filters</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Find events that match your interests
                    </p>
                </div>

                <div>
                    <label htmlFor="keyword-filter" className="block text-sm font-medium text-gray-700 mb-1">
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
                    <label htmlFor="location-filter" className="block text-sm font-medium text-gray-700 mb-1">
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
                    <label htmlFor="date-range-filter" className="block text-sm font-medium text-gray-700 mb-1">
                        Date range
                    </label>
                    <select
                        id="date-range-filter"
                        value={formState.dateRange}
                        onChange={(event) =>
                            onFormStateChange({
                                ...formState,
                                dateRange: event.target.value as DateRangeSelection,
                            })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {dateRangeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                {formState.dateRange === 'custom' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="start-date-filter" className="block text-sm font-medium text-gray-700 mb-1">
                                Starts after
                            </label>
                            <Input
                                id="start-date-filter"
                                type="date"
                                value={formState.startDate}
                                onChange={(event) =>
                                    onFormStateChange({ ...formState, startDate: event.target.value })
                                }
                            />
                        </div>
                        <div>
                            <label htmlFor="end-date-filter" className="block text-sm font-medium text-gray-700 mb-1">
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
                    <label htmlFor="mode-filter" className="block text-sm font-medium text-gray-700 mb-1">
                        Attendance mode
                    </label>
                    <select
                        id="mode-filter"
                        value={formState.mode}
                        onChange={(event) =>
                            onFormStateChange({ ...formState, mode: event.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Any</option>
                        <option value="OfflineEventAttendanceMode">In person</option>
                        <option value="OnlineEventAttendanceMode">Online</option>
                        <option value="MixedEventAttendanceMode">Hybrid</option>
                    </select>
                </div>

                <div>
                    <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                    </label>
                    <select
                        id="status-filter"
                        value={formState.status}
                        onChange={(event) =>
                            onFormStateChange({ ...formState, status: event.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Any</option>
                        <option value="EventScheduled">Scheduled</option>
                        <option value="EventPostponed">Postponed</option>
                        <option value="EventCancelled">Cancelled</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label htmlFor="categories-filter" className="block text-sm font-medium text-gray-700">
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
                                    <button
                                        type="button"
                                        aria-label={`Remove ${category}`}
                                        onClick={() => handleRemoveCategory(category)}
                                        className="ml-1 text-gray-500 hover:text-gray-700"
                                    >
                                        ×
                                    </button>
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
