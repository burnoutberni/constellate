import { useState, KeyboardEvent, type ReactNode } from 'react'
import { Button, Input, Badge, Select } from './ui'
import { DATE_RANGE_LABELS, type DateRangeSelection } from '../lib/searchConstants'

interface SearchFilters {
  q: string
  location: string
  dateRange: DateRangeSelection
  startDate: string
  endDate: string
  mode: string
  status: string
  categories: string[]
}

interface AdvancedSearchFiltersProps {
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
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
  { value: '', label: 'Any' },
  { value: 'OfflineEventAttendanceMode', label: 'In person' },
  { value: 'OnlineEventAttendanceMode', label: 'Online' },
  { value: 'MixedEventAttendanceMode', label: 'Hybrid' },
] as const

const STATUS_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'EventScheduled', label: 'Scheduled' },
  { value: 'EventPostponed', label: 'Postponed' },
  { value: 'EventCancelled', label: 'Cancelled' },
] as const

/**
 * AdvancedSearchFilters component with collapsible sections.
 * Provides comprehensive filtering options for event search.
 */
export function AdvancedSearchFilters({
  filters,
  onFiltersChange,
  onApply,
  onClear,
  className,
}: AdvancedSearchFiltersProps) {
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
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm">
        <div className="p-4 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Advanced Filters</h2>
              <p className="text-sm text-neutral-500 mt-1">
                {(() => {
                  if (activeFiltersCount === 0) {
return 'Refine your search'
}
                  const filterWord = activeFiltersCount === 1 ? 'filter' : 'filters'
                  return `${activeFiltersCount} ${filterWord} applied`
                })()}
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {/* Basic Search Section */}
          <FilterSection
            title="Basic Search"
            expanded={expandedSections.basic}
            onToggle={() => toggleSection('basic')}
          >
            <div className="space-y-4">
              <Input
                label="Keyword"
                type="text"
                value={filters.q}
                onChange={(e) => onFiltersChange({ ...filters, q: e.target.value })}
                placeholder="Search titles or descriptions"
              />

              <Input
                label="Location"
                type="text"
                value={filters.location}
                onChange={(e) => onFiltersChange({ ...filters, location: e.target.value })}
                placeholder="City, venue, or keyword"
              />
            </div>
          </FilterSection>

          {/* Date Range Section */}
          <FilterSection
            title="Date Range"
            expanded={expandedSections.date}
            onToggle={() => toggleSection('date')}
          >
            <div className="space-y-4">
              <Select
                label="Date range"
                value={filters.dateRange}
                onChange={(e) => onFiltersChange({ ...filters, dateRange: e.target.value as DateRangeSelection })}
              >
                {DATE_RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              {filters.dateRange === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Starts after"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => onFiltersChange({ ...filters, startDate: e.target.value })}
                  />
                  <Input
                    label="Ends before"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => onFiltersChange({ ...filters, endDate: e.target.value })}
                  />
                </div>
              )}
            </div>
          </FilterSection>

          {/* Event Details Section */}
          <FilterSection
            title="Event Details"
            expanded={expandedSections.details}
            onToggle={() => toggleSection('details')}
          >
            <div className="space-y-4">
              <Select
                label="Attendance mode"
                value={filters.mode}
                onChange={(e) => onFiltersChange({ ...filters, mode: e.target.value })}
              >
                {ATTENDANCE_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <Select
                label="Status"
                value={filters.status}
                onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
              >
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
            title="Categories / Tags"
            expanded={expandedSections.categories}
            onToggle={() => toggleSection('categories')}
          >
            <div className="space-y-3">
              <Input
                label="Add category or tag"
                type="text"
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                onKeyDown={handleCategoryKeyDown}
                placeholder="Press Enter to add"
              />

              {filters.categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {filters.categories.map((category) => (
                    <Badge key={category} variant="primary">
                      #{category}
                      <Button
                        type="button"
                        onClick={() => handleRemoveCategory(category)}
                        variant="ghost"
                        size="sm"
                        className="ml-2 hover:text-error-600 h-auto p-0 min-w-0"
                        aria-label={`Remove ${category}`}
                      >
                        ×
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </FilterSection>
        </div>

        <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex gap-3">
          <Button
            variant="primary"
            fullWidth
            onClick={onApply}
          >
            Apply Filters
          </Button>
          <Button
            variant="ghost"
            onClick={onClear}
          >
            Clear
          </Button>
        </div>
      </div>
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
    <div>
      <Button
        onClick={onToggle}
        variant="ghost"
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 transition-colors"
      >
        <span className="font-medium text-neutral-900">{title}</span>
        <svg
          className={`w-5 h-5 text-neutral-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>
      {expanded && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  )
}
