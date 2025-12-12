import { EventVisibility } from '@/types'

import { VISIBILITY_OPTIONS } from '../lib/visibility'

interface VisibilitySelectorProps {
	value: EventVisibility
	onChange: (value: EventVisibility) => void
}

/**
 * VisibilitySelector component for choosing event visibility level
 * Provides clear options for public, followers-only, unlisted, and private events
 */
export function VisibilitySelector({ value, onChange }: VisibilitySelectorProps) {
	return (
		<div>
			<label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
				Visibility
			</label>
			<div className="grid gap-2">
				{VISIBILITY_OPTIONS.map((option) => {
					const selected = value === option.value
					return (
						<label
							key={option.value}
							className={`flex gap-3 border rounded-lg p-3 cursor-pointer transition-colors ${
								selected
									? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
									: 'border-neutral-200 dark:border-neutral-700 hover:border-primary-200 dark:hover:border-primary-800'
							}`}>
							<input
								type="radio"
								name="visibility"
								value={option.value}
								checked={selected}
								onChange={() => onChange(option.value)}
								className="sr-only"
								aria-label={option.label}
							/>
							<div className="flex-1">
								<div className="font-medium text-neutral-900 dark:text-neutral-100">
									{option.label}
								</div>
								<div className="text-sm text-neutral-500 dark:text-neutral-400">
									{option.description}
								</div>
							</div>
						</label>
					)
				})}
			</div>
		</div>
	)
}
