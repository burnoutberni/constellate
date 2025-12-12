import { Card, CardContent, Spinner } from './ui'

interface EventStatsProps {
  /**
   * Total number of events
   */
  totalEvents: number
  /**
   * Number of upcoming events
   */
  upcomingEvents: number
  /**
   * Number of events today (optional)
   */
  todayEvents?: number
  /**
   * Number of active users (optional)
   */
  activeUsers?: number
  /**
   * Whether the stats are loading
   */
  isLoading?: boolean
}

/**
 * EventStats component - Displays event statistics
 * Shows total events, upcoming events, and other relevant metrics
 */
export function EventStats({
  totalEvents,
  upcomingEvents,
  todayEvents,
  activeUsers,
  isLoading = false,
}: EventStatsProps) {
  const stats = [
    {
      label: 'Total Events',
      value: totalEvents,
      icon: '📊',
    },
    {
      label: 'Upcoming',
      value: upcomingEvents,
      icon: '🗓️',
    },
  ]

  if (todayEvents !== undefined) {
    stats.push({
      label: "Today's Events",
      value: todayEvents,
      icon: '📅',
    })
  }

  if (activeUsers !== undefined) {
    stats.push({
      label: 'Active Users',
      value: activeUsers,
      icon: '👥',
    })
  }

  return (
    <Card variant="elevated" padding="md">
      <h2 className="text-xl font-bold text-text-primary mb-4">
        Platform Statistics
      </h2>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center justify-center p-4 rounded-lg bg-background-secondary hover:bg-background-tertiary transition-colors"
              >
                <span className="text-3xl mb-2" role="img" aria-label={stat.label}>
                  {stat.icon}
                </span>
                <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                  {stat.value}
                </div>
                <div className="text-sm text-text-secondary mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
