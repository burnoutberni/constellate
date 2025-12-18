import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { SearchFilters, type SearchFiltersState } from '../../components/SearchFilters'

describe('SearchFilters', () => {
	const defaultFilters: SearchFiltersState = {
		q: '',
		location: '',
		dateRange: 'anytime',
		startDate: '',
		endDate: '',
		mode: '',
		status: '',
		categories: [],
	}

	it('user can see filter sections', () => {
		const onFiltersChange = vi.fn()
		const onApply = vi.fn()
		const onClear = vi.fn()

		render(
			<SearchFilters
				filters={defaultFilters}
				onFiltersChange={onFiltersChange}
				onApply={onApply}
				onClear={onClear}
			/>
		)

		expect(screen.getByText('Keywords & Location')).toBeInTheDocument()
		expect(screen.getByText('Date & Time')).toBeInTheDocument()
		expect(screen.getByText('Event Type')).toBeInTheDocument()
		expect(screen.getByText('Tags')).toBeInTheDocument()
	})

	it('user can enter search keywords', async () => {
		const user = userEvent.setup()
		const onApply = vi.fn()
		const onClear = vi.fn()

		const TestWrapper = () => {
			const [filters, setFilters] = useState<SearchFiltersState>(defaultFilters)
			return (
				<SearchFilters
					filters={filters}
					onFiltersChange={setFilters}
					onApply={onApply}
					onClear={onClear}
				/>
			)
		}

		render(<TestWrapper />)

		const keywordInput = screen.getByLabelText('Keyword')
		await user.type(keywordInput, 'conference')

		// After typing, the input should have the full value
		expect(keywordInput).toHaveValue('conference')
	})

	it('user can enter location', async () => {
		const user = userEvent.setup()
		const onApply = vi.fn()
		const onClear = vi.fn()

		const TestWrapper = () => {
			const [filters, setFilters] = useState<SearchFiltersState>(defaultFilters)
			return (
				<SearchFilters
					filters={filters}
					onFiltersChange={setFilters}
					onApply={onApply}
					onClear={onClear}
				/>
			)
		}

		render(<TestWrapper />)

		const locationInput = screen.getByLabelText('Location')
		await user.type(locationInput, 'San Francisco')

		// After typing, the input should have the full value
		expect(locationInput).toHaveValue('San Francisco')
	})

	it('user can select date range', async () => {
		const user = userEvent.setup()
		const onFiltersChange = vi.fn()
		const onApply = vi.fn()
		const onClear = vi.fn()

		render(
			<SearchFilters
				filters={defaultFilters}
				onFiltersChange={onFiltersChange}
				onApply={onApply}
				onClear={onClear}
			/>
		)

		const dateRangeSelect = screen.getByLabelText('When')
		await user.selectOptions(dateRangeSelect, 'next_7_days')

		expect(onFiltersChange).toHaveBeenCalledWith({
			...defaultFilters,
			dateRange: 'next_7_days',
		})
	})

	it('user can see custom date inputs when custom date range is selected', async () => {
		const user = userEvent.setup()
		const onApply = vi.fn()
		const onClear = vi.fn()

		const TestWrapper = () => {
			const [filters, setFilters] = useState<SearchFiltersState>(defaultFilters)
			return (
				<SearchFilters
					filters={filters}
					onFiltersChange={setFilters}
					onApply={onApply}
					onClear={onClear}
				/>
			)
		}

		render(<TestWrapper />)

		const dateRangeSelect = screen.getByLabelText('When')
		await user.selectOptions(dateRangeSelect, 'custom')

		// Wait for the inputs to appear after state update
		await screen.findByLabelText('From')
		expect(screen.getByLabelText('From')).toBeInTheDocument()
		expect(screen.getByLabelText('Until')).toBeInTheDocument()
	})

	it('user can add tags by pressing Enter', async () => {
		const user = userEvent.setup()
		const onFiltersChange = vi.fn()
		const onApply = vi.fn()
		const onClear = vi.fn()

		render(
			<SearchFilters
				filters={defaultFilters}
				onFiltersChange={onFiltersChange}
				onApply={onApply}
				onClear={onClear}
			/>
		)

		const tagInput = screen.getByLabelText('Add Tag')
		await user.type(tagInput, 'tech{Enter}')

		expect(onFiltersChange).toHaveBeenCalledWith({
			...defaultFilters,
			categories: ['tech'],
		})
	})

	it('user can remove tags', async () => {
		const user = userEvent.setup()
		const onFiltersChange = vi.fn()
		const onApply = vi.fn()
		const onClear = vi.fn()

		const filtersWithTag: SearchFiltersState = {
			...defaultFilters,
			categories: ['tech'],
		}

		render(
			<SearchFilters
				filters={filtersWithTag}
				onFiltersChange={onFiltersChange}
				onApply={onApply}
				onClear={onClear}
			/>
		)

		const removeButton = screen.getByLabelText('Remove tech')
		await user.click(removeButton)

		expect(onFiltersChange).toHaveBeenCalledWith({
			...defaultFilters,
			categories: [],
		})
	})

	it('user can apply filters', async () => {
		const user = userEvent.setup()
		const onFiltersChange = vi.fn()
		const onApply = vi.fn()
		const onClear = vi.fn()

		render(
			<SearchFilters
				filters={defaultFilters}
				onFiltersChange={onFiltersChange}
				onApply={onApply}
				onClear={onClear}
			/>
		)

		const applyButton = screen.getByRole('button', { name: 'Show Results' })
		await user.click(applyButton)

		expect(onApply).toHaveBeenCalledTimes(1)
	})

	it('user can clear all filters', async () => {
		const user = userEvent.setup()
		const onFiltersChange = vi.fn()
		const onApply = vi.fn()
		const onClear = vi.fn()

		const filtersWithValues: SearchFiltersState = {
			q: 'test',
			location: 'SF',
			dateRange: 'next_7_days',
			startDate: '',
			endDate: '',
			mode: 'OfflineEventAttendanceMode',
			status: 'EventScheduled',
			categories: ['tech'],
		}

		render(
			<SearchFilters
				filters={filtersWithValues}
				onFiltersChange={onFiltersChange}
				onApply={onApply}
				onClear={onClear}
			/>
		)

		const resetButton = screen.getByRole('button', { name: 'Reset' })
		await user.click(resetButton)

		expect(onClear).toHaveBeenCalledTimes(1)
	})

	it('user can see active filter count', () => {
		const onFiltersChange = vi.fn()
		const onApply = vi.fn()
		const onClear = vi.fn()

		const filtersWithValues: SearchFiltersState = {
			q: 'test',
			location: 'SF',
			dateRange: 'anytime',
			startDate: '',
			endDate: '',
			mode: '',
			status: '',
			categories: ['tech', 'networking'],
		}

		render(
			<SearchFilters
				filters={filtersWithValues}
				onFiltersChange={onFiltersChange}
				onApply={onApply}
				onClear={onClear}
			/>
		)

		expect(screen.getByText(/4 active filters/)).toBeInTheDocument()
	})

	it('user can collapse and expand filter sections', async () => {
		const user = userEvent.setup()
		const onFiltersChange = vi.fn()
		const onApply = vi.fn()
		const onClear = vi.fn()

		render(
			<SearchFilters
				filters={defaultFilters}
				onFiltersChange={onFiltersChange}
				onApply={onApply}
				onClear={onClear}
			/>
		)

		const dateSection = screen.getByText('Date & Time').closest('button')
		expect(dateSection).toBeInTheDocument()

		// Section should be expanded by default
		expect(screen.getByLabelText('When')).toBeInTheDocument()

		// Click to collapse
		if (dateSection) {
			await user.click(dateSection)
		}

		// Section should be collapsed
		expect(screen.queryByLabelText('When')).not.toBeInTheDocument()
	})

	it('user sees no active filters message when no filters are set', () => {
		const onFiltersChange = vi.fn()
		const onApply = vi.fn()
		const onClear = vi.fn()

		render(
			<SearchFilters
				filters={defaultFilters}
				onFiltersChange={onFiltersChange}
				onApply={onApply}
				onClear={onClear}
			/>
		)

		expect(screen.getByText('Refine your search')).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
	})
})
