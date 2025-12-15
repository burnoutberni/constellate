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
	const [value, setValue] = useState<{
		pattern: '' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
		endDate: string
	}>({
		pattern: '',
		endDate: '',
	})
	// Use a fixed date instead of Date.now() to avoid impure function call
	const startTime = new Date('2024-12-25T12:00:00Z').toISOString()
	return (
		<RecurrenceSelector
			value={value}
			onChange={(newValue) => setValue(newValue)}
			startTime={startTime}
		/>
	)
}

export const Default: Story = {
	render: () => <SelectorWrapper />,
}

const WithErrorWrapper = () => {
	const [value, setValue] = useState<{
		pattern: '' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
		endDate: string
	}>({
		pattern: 'WEEKLY',
		endDate: '',
	})
	// Use a fixed date instead of Date.now() to avoid impure function call
	const startTime = new Date('2024-12-25T12:00:00Z').toISOString()
	return (
		<RecurrenceSelector
			value={value}
			onChange={(newValue) => setValue(newValue)}
			startTime={startTime}
			error="Please select an end date"
		/>
	)
}

export const WithError: Story = {
	render: () => <WithErrorWrapper />,
}

const WeeklyWrapper = () => {
	const [value, setValue] = useState<{
		pattern: '' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
		endDate: string
	}>({
		pattern: 'WEEKLY',
		// Use a fixed date instead of Date.now() to avoid impure function call
		endDate: new Date('2025-01-25T12:00:00Z').toISOString().split('T')[0],
	})
	// Use a fixed date instead of Date.now() to avoid impure function call
	const startTime = new Date('2024-12-25T12:00:00Z').toISOString()
	return (
		<RecurrenceSelector
			value={value}
			onChange={(newValue) => setValue(newValue)}
			startTime={startTime}
		/>
	)
}

export const Weekly: Story = {
	render: () => <WeeklyWrapper />,
}
