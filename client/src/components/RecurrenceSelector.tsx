import { Input } from './ui'

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
      <div>
        <label htmlFor="recurrence-pattern" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Recurrence
        </label>
        <select
          id="recurrence-pattern"
          value={value.pattern}
          onChange={(e) => handlePatternChange(e.target.value as RecurrencePattern['pattern'])}
          className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          {RECURRENCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

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
