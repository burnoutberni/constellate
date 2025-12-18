import { Input, Select } from './ui'

interface RecurrencePattern {
	pattern: '' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
	endDate: string
}

interface RecurrenceSelectorProps {
	value: RecurrencePattern
	onChange: (value: RecurrencePattern) => void
	startTime: string
	error?: string
}

const RECURRENCE_OPTIONS = [
	{ value: '', label: 'Does not repeat' },
	{ value: 'DAILY', label: 'Daily' },
	{ value: 'WEEKLY', label: 'Weekly' },
	{ value: 'MONTHLY', label: 'Monthly' },
] as const

/**
 * RecurrenceSelector component for selecting event recurrence patterns
 * Allows users to choose how often an event repeats and when it stops
 */
export function RecurrenceSelector({ value, onChange, startTime, error }: RecurrenceSelectorProps) {
	const handlePatternChange = (pattern: RecurrencePattern['pattern']) => {
		onChange({
			pattern,
			endDate: pattern ? value.endDate : '',
		})
	}

	const handleEndDateChange = (endDate: string) => {
		onChange({
			...value,
			endDate,
		})
	}

	const minEndDate = startTime ? startTime.split('T')[0] : undefined

	return (
		<div className="space-y-4">
			<Select
				id="recurrence-pattern"
				label="Recurrence"
				value={value.pattern}
				onChange={(e) =>
					handlePatternChange(e.target.value as RecurrencePattern['pattern'])
				}>
				{RECURRENCE_OPTIONS.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</Select>

			{value.pattern && (
				<Input
					id="recurrence-end-date"
					type="date"
					label="Repeat until"
					value={value.endDate}
					onChange={(e) => handleEndDateChange(e.target.value)}
					required
					min={minEndDate}
					error={Boolean(error)}
					errorMessage={error}
					helperText="Recurring events show on the calendar up to this date."
					fullWidth
				/>
			)}
		</div>
	)
}
