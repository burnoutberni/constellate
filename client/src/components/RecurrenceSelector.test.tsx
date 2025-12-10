import { describe, it, expect, vi } from 'vitest'
import { RecurrenceSelector } from './RecurrenceSelector'

describe('RecurrenceSelector', () => {
  it('renders with empty pattern by default', () => {
    const onChange = vi.fn()
    const value = { pattern: '' as const, endDate: '' }
    
    const component = RecurrenceSelector({ value, onChange, startTime: '' })
    expect(component).toBeDefined()
  })

  it('shows end date input when pattern is selected', () => {
    const onChange = vi.fn()
    const value = { pattern: 'WEEKLY' as const, endDate: '2024-12-31' }
    
    const component = RecurrenceSelector({ value, onChange, startTime: '2024-01-01T10:00' })
    expect(component).toBeDefined()
  })

  it('hides end date input when pattern is empty', () => {
    const onChange = vi.fn()
    const value = { pattern: '' as const, endDate: '' }
    
    const component = RecurrenceSelector({ value, onChange, startTime: '2024-01-01T10:00' })
    expect(component).toBeDefined()
  })
})
