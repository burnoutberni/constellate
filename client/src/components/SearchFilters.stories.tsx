import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'

import { SearchFilters, type SearchFiltersState } from './SearchFilters'

const meta = {
	title: 'Components/SearchFilters',
	component: SearchFilters,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof SearchFilters>

export default meta
type Story = StoryObj<typeof SearchFilters>

const SearchFiltersWrapper = () => {
	const [filters, setFilters] = useState<SearchFiltersState>({
		q: '',
		location: '',
		dateRange: 'anytime',
		startDate: '',
		endDate: '',
		mode: '',
		status: '',
		categories: [],
	})

	return (
		<div className="max-w-sm">
			<SearchFilters
				filters={filters}
				onFiltersChange={setFilters}
				onApply={() => {
					// Apply filters action
				}}
				onClear={() => {
					setFilters({
						q: '',
						location: '',
						dateRange: 'anytime',
						startDate: '',
						endDate: '',
						mode: '',
						status: '',
						categories: [],
					})
				}}
			/>
		</div>
	)
}

export const Default: Story = {
	render: () => <SearchFiltersWrapper />,
}

const WithActiveFiltersWrapper = () => {
	const [filters, setFilters] = useState<SearchFiltersState>({
		q: 'conference',
		location: 'San Francisco',
		dateRange: 'next_7_days',
		startDate: '',
		endDate: '',
		mode: 'OfflineEventAttendanceMode',
		status: 'EventScheduled',
		categories: ['tech', 'networking'],
	})

	return (
		<div className="max-w-sm">
			<SearchFilters
				filters={filters}
				onFiltersChange={setFilters}
				onApply={() => {
					// Apply filters action
				}}
				onClear={() => {
					setFilters({
						q: '',
						location: '',
						dateRange: 'anytime',
						startDate: '',
						endDate: '',
						mode: '',
						status: '',
						categories: [],
					})
				}}
			/>
		</div>
	)
}

export const WithActiveFilters: Story = {
	render: () => <WithActiveFiltersWrapper />,
}

const WithCustomDateRangeWrapper = () => {
	const [filters, setFilters] = useState<SearchFiltersState>({
		q: '',
		location: '',
		dateRange: 'custom',
		startDate: '2024-06-01',
		endDate: '2024-06-30',
		mode: '',
		status: '',
		categories: [],
	})

	return (
		<div className="max-w-sm">
			<SearchFilters
				filters={filters}
				onFiltersChange={setFilters}
				onApply={() => {
					// Apply filters action
				}}
				onClear={() => {
					setFilters({
						q: '',
						location: '',
						dateRange: 'anytime',
						startDate: '',
						endDate: '',
						mode: '',
						status: '',
						categories: [],
					})
				}}
			/>
		</div>
	)
}

export const WithCustomDateRange: Story = {
	render: () => <WithCustomDateRangeWrapper />,
}
