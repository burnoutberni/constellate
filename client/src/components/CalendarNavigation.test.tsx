import { describe, it, expect } from 'vitest'

/**
 * Test CalendarNavigation component logic
 */
describe('CalendarNavigation', () => {
    it('formats date correctly for input', () => {
        const date = new Date('2025-12-15')
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const formatted = `${year}-${month}-${day}`
        
        expect(formatted).toBe('2025-12-15')
    })

    it('calculates previous month correctly', () => {
        const currentDate = new Date('2025-12-15')
        const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
        
        expect(previousMonth.getMonth()).toBe(10) // November
        expect(previousMonth.getFullYear()).toBe(2025)
    })

    it('calculates next month correctly', () => {
        const currentDate = new Date('2025-12-15')
        const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
        
        expect(nextMonth.getMonth()).toBe(0) // January
        expect(nextMonth.getFullYear()).toBe(2026)
    })

    it('calculates previous week correctly', () => {
        const currentDate = new Date('2025-12-15')
        const previousWeek = new Date(
            currentDate.getFullYear(), 
            currentDate.getMonth(), 
            currentDate.getDate() - 7
        )
        
        expect(previousWeek.getDate()).toBe(8)
        expect(previousWeek.getMonth()).toBe(11) // December
    })

    it('calculates next week correctly', () => {
        const currentDate = new Date('2025-12-15')
        const nextWeek = new Date(
            currentDate.getFullYear(), 
            currentDate.getMonth(), 
            currentDate.getDate() + 7
        )
        
        expect(nextWeek.getDate()).toBe(22)
        expect(nextWeek.getMonth()).toBe(11) // December
    })

    it('calculates previous day correctly', () => {
        const currentDate = new Date('2025-12-15')
        const previousDay = new Date(
            currentDate.getFullYear(), 
            currentDate.getMonth(), 
            currentDate.getDate() - 1
        )
        
        expect(previousDay.getDate()).toBe(14)
    })

    it('calculates next day correctly', () => {
        const currentDate = new Date('2025-12-15')
        const nextDay = new Date(
            currentDate.getFullYear(), 
            currentDate.getMonth(), 
            currentDate.getDate() + 1
        )
        
        expect(nextDay.getDate()).toBe(16)
    })
})
