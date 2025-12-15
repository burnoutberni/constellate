import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { RecurrenceSelector } from './RecurrenceSelector'

const meta = {
	title: 'Components/RecurrenceSelector',
	component: RecurrenceSelector,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	args: {
		value: { pattern: '' as const, endDate: '' },
		onChange: () => {},
		startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
	},
	argTypes: {
		onChange: {
			control: false,
		},
	},
} satisfies Meta<typeof RecurrenceSelector>

export default meta
type Story = StoryObj<typeof RecurrenceSelector>

const SelectorWrapper = () => {
	const [value, setValue] = useState({ pattern: '' as const, endDate: '' })
	const startTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
	return <RecurrenceSelector value={value} onChange={setValue} startTime={startTime} />
}

export const Default: Story = {
	render: () => <SelectorWrapper />,
}

export const WithError: Story = {
	render: () => {
		const [value, setValue] = useState({ pattern: 'WEEKLY' as const, endDate: '' })
		const startTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
		return (
			<RecurrenceSelector
				value={value}
				onChange={setValue}
				startTime={startTime}
				error="Please select an end date"
			/>
		)
	},
}

export const Weekly: Story = {
	render: () => {
		const [value, setValue] = useState({
			pattern: 'WEEKLY' as const,
			endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
		})
		const startTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
		return <RecurrenceSelector value={value} onChange={setValue} startTime={startTime} />
	},
}
