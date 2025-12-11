import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EventFilters, type FilterFormState } from '../../components/EventFilters'

const defaultFormState: FilterFormState = {
    q: '',
    location: '',
    dateRange: 'anytime',
    startDate: '',
    endDate: '',
    mode: '',
    status: '',
    categories: [],
}

describe('EventFilters Component', () => {
    it('should render filter form', () => {
        const handleFormStateChange = vi.fn()
        const handleSubmit = vi.fn()
        const handleClearAll = vi.fn()

        render(
            <EventFilters
                formState={defaultFormState}
                onFormStateChange={handleFormStateChange}
                onSubmit={handleSubmit}
                onClearAll={handleClearAll}
            />
        )

        expect(screen.getByLabelText('Keyword')).toBeInTheDocument()
        expect(screen.getByLabelText('Location')).toBeInTheDocument()
        expect(screen.getByLabelText('Date range')).toBeInTheDocument()
    })

    it('should call onFormStateChange when keyword input changes', () => {
        const handleFormStateChange = vi.fn()
        const handleSubmit = vi.fn()
        const handleClearAll = vi.fn()

        render(
            <EventFilters
                formState={defaultFormState}
                onFormStateChange={handleFormStateChange}
                onSubmit={handleSubmit}
                onClearAll={handleClearAll}
            />
        )

        const keywordInput = screen.getByLabelText('Keyword')
        fireEvent.change(keywordInput, { target: { value: 'test' } })

        expect(handleFormStateChange).toHaveBeenCalledWith({
            ...defaultFormState,
            q: 'test',
        })
    })

    it('should call onSubmit when form is submitted', () => {
        const handleFormStateChange = vi.fn()
        const handleSubmit = vi.fn((e) => e.preventDefault())
        const handleClearAll = vi.fn()

        render(
            <EventFilters
                formState={defaultFormState}
                onFormStateChange={handleFormStateChange}
                onSubmit={handleSubmit}
                onClearAll={handleClearAll}
            />
        )

        const submitButton = screen.getByRole('button', { name: 'Apply filters' })
        fireEvent.click(submitButton)

        expect(handleSubmit).toHaveBeenCalled()
    })

    it('should call onClearAll when Clear button is clicked', () => {
        const handleFormStateChange = vi.fn()
        const handleSubmit = vi.fn()
        const handleClearAll = vi.fn()

        render(
            <EventFilters
                formState={defaultFormState}
                onFormStateChange={handleFormStateChange}
                onSubmit={handleSubmit}
                onClearAll={handleClearAll}
            />
        )

        const clearButton = screen.getByRole('button', { name: 'Clear' })
        fireEvent.click(clearButton)

        expect(handleClearAll).toHaveBeenCalled()
    })

    it('should display custom date inputs when custom date range is selected', () => {
        const handleFormStateChange = vi.fn()
        const handleSubmit = vi.fn()
        const handleClearAll = vi.fn()

        const customFormState = {
            ...defaultFormState,
            dateRange: 'custom' as const,
        }

        render(
            <EventFilters
                formState={customFormState}
                onFormStateChange={handleFormStateChange}
                onSubmit={handleSubmit}
                onClearAll={handleClearAll}
            />
        )

        expect(screen.getByLabelText('Starts after')).toBeInTheDocument()
        expect(screen.getByLabelText('Ends before')).toBeInTheDocument()
    })

    it('should render attendance mode select', () => {
        const handleFormStateChange = vi.fn()
        const handleSubmit = vi.fn()
        const handleClearAll = vi.fn()

        render(
            <EventFilters
                formState={defaultFormState}
                onFormStateChange={handleFormStateChange}
                onSubmit={handleSubmit}
                onClearAll={handleClearAll}
            />
        )

        const modeSelect = screen.getByLabelText('Attendance mode')
        expect(modeSelect).toBeInTheDocument()
        expect(modeSelect.querySelector('option[value="OfflineEventAttendanceMode"]')).toBeInTheDocument()
        expect(modeSelect.querySelector('option[value="OnlineEventAttendanceMode"]')).toBeInTheDocument()
    })

    it('should display selected categories', () => {
        const handleFormStateChange = vi.fn()
        const handleSubmit = vi.fn()
        const handleClearAll = vi.fn()

        const formStateWithCategories = {
            ...defaultFormState,
            categories: ['tech', 'meetup'],
        }

        render(
            <EventFilters
                formState={formStateWithCategories}
                onFormStateChange={handleFormStateChange}
                onSubmit={handleSubmit}
                onClearAll={handleClearAll}
            />
        )

        expect(screen.getByText('#tech')).toBeInTheDocument()
        expect(screen.getByText('#meetup')).toBeInTheDocument()
    })
})
