import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'

import { EventFilters, type FilterFormState } from './EventFilters'

const meta = {
	title: 'Components/EventFilters',
	component: EventFilters,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	args: {
		formState: {
			q: '',
			location: '',
			dateRange: 'anytime',
			startDate: '',
			endDate: '',
			mode: 'all',
			status: 'all',
			categories: [],
		},
		onFormStateChange: () => {},
		onSubmit: () => {},
		onClearAll: () => {},
	},
	argTypes: {
		onFormStateChange: {
			control: false,
		},
		onSubmit: {
			control: false,
		},
		onClearAll: {
			control: false,
		},
	},
} satisfies Meta<typeof EventFilters>

export default meta
type Story = StoryObj<typeof EventFilters>

const FilterWrapper = () => {
	const [formState, setFormState] = useState<FilterFormState>({
		q: '',
		location: '',
		dateRange: 'anytime',
		startDate: '',
		endDate: '',
		mode: 'all',
		status: 'all',
		categories: [],
	})

	return (
		<EventFilters
			formState={formState}
			onFormStateChange={setFormState}
			onSubmit={(e) => {
				e.preventDefault()
				// Submit handler
			}}
			onClearAll={() => {
				setFormState({
					q: '',
					location: '',
					dateRange: 'anytime',
					startDate: '',
					endDate: '',
					mode: 'all',
					status: 'all',
					categories: [],
				})
			}}
		/>
	)
}

export const Default: Story = {
	render: () => <FilterWrapper />,
}
