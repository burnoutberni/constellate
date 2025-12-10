import { useAuth } from '../contexts/AuthContext'

export const REMINDER_OPTIONS: Array<{ label: string; value: number | null }> = [
    { label: 'No reminder', value: null },
    { label: '5 minutes before', value: 5 },
    { label: '15 minutes before', value: 15 },
    { label: '30 minutes before', value: 30 },
    { label: '1 hour before', value: 60 },
    { label: '2 hours before', value: 120 },
    { label: '1 day before', value: 1440 },
]

interface ReminderSelectorProps {
    value: number | null
    onChange: (value: number | null) => void
    disabled?: boolean
    isPending?: boolean
    helperText?: string
    onSignUpRequired?: () => void
}

export function ReminderSelector({
    value,
    onChange,
    disabled = false,
    isPending = false,
    helperText,
    onSignUpRequired,
}: ReminderSelectorProps) {
    const { user } = useAuth()

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const nextValue = e.target.value === '' ? null : Number(e.target.value)

        if (!user && onSignUpRequired) {
            onSignUpRequired()
            return
        }

        onChange(nextValue)
    }

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-text-primary">Reminder</label>
            <select
                value={value !== null ? value : ''}
                onChange={handleChange}
                disabled={disabled || isPending}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            >
                {REMINDER_OPTIONS.map((option) => (
                    <option key={option.label} value={option.value !== null ? option.value : ''}>
                        {option.label}
                    </option>
                ))}
            </select>
            {isPending && <span className="text-sm text-text-secondary">Saving...</span>}
            {helperText && <p className="text-xs text-text-secondary">{helperText}</p>}
        </div>
    )
}
