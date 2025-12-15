import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'

import { ActivityFilters } from './ActivityFilters'

const meta = {
	title: 'Components/ActivityFilters',
	component: ActivityFilters,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	args: {
		activeFilter: 'all',
		onFilterChange: () => {},
	},
	argTypes: {
		onFilterChange: {
			control: false,
		},
	},
} satisfies Meta<typeof ActivityFilters>

export default meta
type Story = StoryObj<typeof ActivityFilters>

const FilterWrapper = () => {
	const [activeFilter, setActiveFilter] = useState<'all' | 'events' | 'interactions'>('all')
	return <ActivityFilters activeFilter={activeFilter} onFilterChange={setActiveFilter} />
}

export const Default: Story = {
	render: () => <FilterWrapper />,
}
