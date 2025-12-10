import { InstanceCard } from './InstanceCard'
import type { InstanceWithStats } from '../types'

interface InstanceListProps {
    instances: InstanceWithStats[]
    onBlock?: (domain: string) => void
    onUnblock?: (domain: string) => void
    onRefresh?: (domain: string) => void
}

export function InstanceList({ instances, onBlock, onUnblock, onRefresh }: InstanceListProps) {
    if (instances.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-600 dark:text-gray-400">No instances found</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {instances.map((instance) => (
                <InstanceCard
                    key={instance.id}
                    instance={instance}
                    onBlock={onBlock}
                    onUnblock={onUnblock}
                    onRefresh={onRefresh}
                />
            ))}
        </div>
    )
}
