import { Card, Spinner } from './ui'

interface CommunityStatsProps {
	totalEvents: number
	totalUsers?: number
	totalInstances?: number
	isLoading?: boolean
}

/**
 * CommunityStats component
 * Displays platform activity metrics in a visually engaging way.
 */
export function CommunityStats({
	totalEvents,
	totalUsers = 0,
	totalInstances = 0,
	isLoading = false,
}: CommunityStatsProps) {
	const stats = [
		{
			label: 'Events Created',
			value: totalEvents,
			icon: '📅',
			description: 'Public events to discover',
		},
		{
			label: 'Active Users',
			value: totalUsers,
			icon: '👥',
			description: 'People connecting daily',
		},
		{
			label: 'Federated Instances',
			value: totalInstances,
			icon: '🌐',
			description: 'Nodes in the network',
		},
	]

	if (isLoading) {
		return (
			<Card className="p-8 flex justify-center bg-background-secondary/50 border-dashed">
				<Spinner size="lg" />
			</Card>
		)
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
			{stats.map((stat) => (
				<Card
					key={stat.label}
					className="relative overflow-hidden group hover:border-primary-200 dark:hover:border-primary-800 transition-colors"
					padding="lg">
					<div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-6xl select-none grayscale">
						{stat.icon}
					</div>
					<div className="relative z-10">
						<div className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-1 tracking-tight">
							{new Intl.NumberFormat('en-US', { notation: 'compact' }).format(
								stat.value
							)}
						</div>
						<div className="font-semibold text-text-primary mb-1">{stat.label}</div>
						<div className="text-sm text-text-secondary">{stat.description}</div>
					</div>
				</Card>
			))}
		</div>
	)
}
