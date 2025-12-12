import { Button } from './ui'

export interface EventTemplate {
	id: string
	name: string
	description?: string | null
	data: {
		title?: string
		summary?: string
		location?: string
		locationLatitude?: number
		locationLongitude?: number
		url?: string
		startTime?: string
		endTime?: string
		headerImage?: string
		timezone?: string
		visibility?: string
		recurrencePattern?: string
		recurrenceEndDate?: string
		tags?: string[]
	}
}

interface TemplateSelectorProps {
	templates: EventTemplate[]
	selectedId: string
	onSelect: (templateId: string) => void
	onRefresh: () => void
	loading?: boolean
	error?: string | null
}

/**
 * TemplateSelector component for choosing and applying event templates
 * Allows users to start creating events from saved templates
 */
export function TemplateSelector({
	templates,
	selectedId,
	onSelect,
	onRefresh,
	loading = false,
	error = null,
}: TemplateSelectorProps) {
	return (
		<div className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 bg-neutral-50 dark:bg-neutral-800/50 space-y-3">
			<div className="flex items-center justify-between">
				<div>
					<p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
						Start from template
					</p>
					<p className="text-xs text-neutral-500 dark:text-neutral-400">
						Prefill fields with a saved configuration.
					</p>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={onRefresh}
					disabled={loading}>
					{loading ? 'Refreshing...' : 'Refresh'}
				</Button>
			</div>
			<select
				value={selectedId}
				onChange={(e) => onSelect(e.target.value)}
				disabled={loading || templates.length === 0}
				className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed">
				<option value="">
					{templates.length ? 'Select a template' : 'No templates yet'}
				</option>
				{templates.map((template) => (
					<option key={template.id} value={template.id}>
						{template.name}
					</option>
				))}
			</select>
			{error && <p className="text-xs text-error-500 dark:text-error-400">{error}</p>}
		</div>
	)
}
