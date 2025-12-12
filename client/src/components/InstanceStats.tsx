import type { InstanceWithStats } from '@/types'

interface InstanceStatsProps {
    instance: InstanceWithStats
}

export function InstanceStats({ instance }: InstanceStatsProps) {
    const stats = [
        {
            label: 'Total Users',
            value: instance.userCount?.toLocaleString() ?? 'N/A',
        },
        {
            label: 'Total Events',
            value: instance.eventCount?.toLocaleString() ?? 'N/A',
        },
        {
            label: 'Remote Users',
            value: instance.stats.remoteUsers.toLocaleString(),
        },
        {
            label: 'Remote Events',
            value: instance.stats.remoteEvents.toLocaleString(),
        },
        {
            label: 'Local Following',
            value: instance.stats.localFollowing.toLocaleString(),
        },
    ]

    if (instance.stats.localFollowers !== undefined) {
        stats.push({
            label: 'Local Followers',
            value: instance.stats.localFollowers.toLocaleString(),
        })
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                    <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                        {stat.value}
                    </div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-400">
                        {stat.label}
                    </div>
                </div>
            ))}
        </div>
    )
}
