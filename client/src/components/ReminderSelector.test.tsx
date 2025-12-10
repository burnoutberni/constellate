import { describe, it, expect } from 'vitest'
import { REMINDER_OPTIONS } from './ReminderSelector'

describe('ReminderSelector', () => {
    it('should have correct reminder options', () => {
        expect(REMINDER_OPTIONS).toHaveLength(7)
        expect(REMINDER_OPTIONS[0]).toEqual({ label: 'No reminder', value: null })
        expect(REMINDER_OPTIONS[1]).toEqual({ label: '5 minutes before', value: 5 })
        expect(REMINDER_OPTIONS[6]).toEqual({ label: '1 day before', value: 1440 })
    })

    it('should have valid minute values', () => {
        const validValues = [null, 5, 15, 30, 60, 120, 1440]
        const actualValues = REMINDER_OPTIONS.map((opt) => opt.value)
        expect(actualValues).toEqual(validValues)
    })
})
