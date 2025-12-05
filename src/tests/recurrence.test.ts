import { describe, it, expect } from 'vitest'
import { validateRecurrenceInput } from '../lib/recurrence.js'

describe('validateRecurrenceInput', () => {
    const start = new Date('2025-01-01T10:00:00Z')

    it('allows events without recurrence', () => {
        expect(() => validateRecurrenceInput(start, null, null)).not.toThrow()
    })

    it('throws when recurrence pattern is set without end date', () => {
        expect(() => validateRecurrenceInput(start, 'DAILY', null)).toThrowError(/Recurrence end date is required/)
    })

    it('throws when recurrence end date is before start', () => {
        const end = new Date('2024-12-31T09:59:59Z')
        expect(() => validateRecurrenceInput(start, 'WEEKLY', end)).toThrowError(/Recurrence end date must be after/)
    })

    it('throws when recurrence end date equals start time', () => {
        const end = new Date('2025-01-01T10:00:00Z')
        expect(() => validateRecurrenceInput(start, 'DAILY', end)).toThrowError(/Recurrence end date must be after/)
    })

    it('accepts valid recurrence settings', () => {
        const end = new Date('2025-02-01T10:00:00Z')
        expect(() => validateRecurrenceInput(start, 'MONTHLY', end)).not.toThrow()
    })
})
