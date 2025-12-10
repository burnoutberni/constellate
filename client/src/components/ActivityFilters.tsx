import { Button } from './ui/Button'

export type ActivityFilterType = 'all' | 'events' | 'interactions'

interface ActivityFiltersProps {
    activeFilter: ActivityFilterType
    onFilterChange: (filter: ActivityFilterType) => void
}

/**
 * ActivityFilters component for filtering the activity feed.
 * Allows users to filter by all activities, events only, or interactions only.
 */
export function ActivityFilters({
    activeFilter,
    onFilterChange,
}: ActivityFiltersProps) {
    const filters: Array<{ value: ActivityFilterType; label: string; icon: string }> = [
        { value: 'all', label: 'All', icon: '📋' },
        { value: 'events', label: 'Events', icon: '📅' },
        { value: 'interactions', label: 'Interactions', icon: '💬' },
    ]

    return (
        <div className="flex items-center gap-2 flex-wrap" role="tablist" aria-label="Activity filters">
            {filters.map((filter) => (
                <Button
                    key={filter.value}
                    variant={activeFilter === filter.value ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => onFilterChange(filter.value)}
                    role="tab"
                    aria-selected={activeFilter === filter.value}
                    aria-controls={`activity-panel-${filter.value}`}
                >
                    <span className="mr-1">{filter.icon}</span>
                    {filter.label}
                </Button>
            ))}
        </div>
    )
}
