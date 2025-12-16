import { Grid } from './layout'
import { TemplateCard, type EventTemplate } from './TemplateCard'
import { DocumentIcon, Skeleton, Card } from './ui'

interface TemplateListProps {
	templates: EventTemplate[]
	loading?: boolean
	onEdit: (template: EventTemplate) => void
	onDelete: (templateId: string) => void
	onPreview: (template: EventTemplate) => void
	onUse: (template: EventTemplate) => void
}

export function TemplateList({
	templates,
	loading = false,
	onEdit,
	onDelete,
	onPreview,
	onUse,
}: TemplateListProps) {
	if (loading) {
		// Stable keys for skeleton loaders (static placeholders, index usage is acceptable here)
		const skeletonKeys = [
			'skeleton-0',
			'skeleton-1',
			'skeleton-2',
			'skeleton-3',
			'skeleton-4',
			'skeleton-5',
		]
		return (
			<Grid cols={1} colsMd={2} colsLg={3} gap="md">
				{skeletonKeys.map((key) => (
					<Card key={key} className="p-4 space-y-3">
						<Skeleton className="h-6 w-3/4" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-5/6" />
						<div className="flex gap-2 mt-4">
							<Skeleton className="h-8 w-20" />
							<Skeleton className="h-8 w-20" />
						</div>
					</Card>
				))}
			</Grid>
		)
	}

	if (templates.length === 0) {
		return (
			<Card padding="xl" className="text-center bg-background-secondary border-dashed">
				<DocumentIcon className="mx-auto h-12 w-12 text-text-tertiary" />
				<h3 className="mt-2 text-sm font-medium text-text-primary">No templates yet</h3>
				<p className="mt-1 text-sm text-text-secondary">
					Get started by creating an event and saving it as a template.
				</p>
			</Card>
		)
	}

	return (
		<Grid cols={1} colsMd={2} colsLg={3} gap="md">
			{templates.map((template) => (
				<TemplateCard
					key={template.id}
					template={template}
					onEdit={onEdit}
					onDelete={onDelete}
					onPreview={onPreview}
					onUse={onUse}
				/>
			))}
		</Grid>
	)
}
