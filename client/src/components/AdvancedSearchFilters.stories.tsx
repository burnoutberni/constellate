import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'

import type { DateRangeSelection } from '../lib/searchConstants'

import { AdvancedSearchFilters } from './AdvancedSearchFilters'

const meta = {
	title: 'Components/AdvancedSearchFilters',
	component: AdvancedSearchFilters,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	args: {
		filters: {
			q: '',
			location: '',
			dateRange: 'anytime',
			startDate: '',
			endDate: '',
			mode: '',
			status: '',
			categories: [],
		},
		onFiltersChange: () => {},
		onApply: () => {},
		onClear: () => {},
	},
	argTypes: {
		onFiltersChange: {
			control: false,
		},
		onApply: {
			control: false,
		},
		onClear: {
			control: false,
		},
	},
} satisfies Meta<typeof AdvancedSearchFilters>

export default meta
type Story = StoryObj<typeof AdvancedSearchFilters>

const FilterWrapper = () => {
	const [filters, setFilters] = useState({
		q: '',
		location: '',
		dateRange: 'anytime' as DateRangeSelection,
		startDate: '',
		endDate: '',
		mode: '',
		status: '',
		categories: [] as string[],
	})

	return (
		<AdvancedSearchFilters
			filters={filters}
			onFiltersChange={setFilters}
			onApply={() => {
				// Apply handler
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
	)
}

export const Default: Story = {
	render: () => <FilterWrapper />,
}
