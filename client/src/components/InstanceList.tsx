import type { InstanceWithStats } from '@/types'

import { InstanceCard } from './InstanceCard'
import { Stack } from './layout'
import { Card } from './ui'

interface InstanceListProps {
	instances: InstanceWithStats[]
	onBlock?: (domain: string) => void
	onUnblock?: (domain: string) => void
	onRefresh?: (domain: string) => void
}

export function InstanceList({ instances, onBlock, onUnblock, onRefresh }: InstanceListProps) {
	if (instances.length === 0) {
		return (
			<Card padding="xl" className="text-center bg-background-secondary border-dashed">
				<p className="text-text-secondary">No instances found</p>
			</Card>
		)
	}

	return (
		<Stack direction="column" gap="md">
			{instances.map((instance) => (
				<InstanceCard
					key={instance.id}
					instance={instance}
					onBlock={onBlock}
					onUnblock={onUnblock}
					onRefresh={onRefresh}
				/>
			))}
		</Stack>
	)
}
