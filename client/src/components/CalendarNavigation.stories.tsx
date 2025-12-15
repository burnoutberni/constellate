import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { CalendarNavigation } from './CalendarNavigation'

const meta = {
	title: 'Components/CalendarNavigation',
	component: CalendarNavigation,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	args: {
		view: 'month',
		currentDate: new Date(),
		onViewChange: () => {},
		onDateChange: () => {},
		displayText: 'January 2024',
	},
	argTypes: {
		onViewChange: {
			control: false,
		},
		onDateChange: {
			control: false,
		},
	},
} satisfies Meta<typeof CalendarNavigation>

export default meta
type Story = StoryObj<typeof CalendarNavigation>

const NavigationWrapper = () => {
	const [view, setView] = useState<'month' | 'week' | 'day'>('month')
	const [currentDate, setCurrentDate] = useState(new Date())

	const getDisplayText = () => {
		if (view === 'month') {
			return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
		}
		if (view === 'week') {
			const weekStart = new Date(currentDate)
			weekStart.setDate(currentDate.getDate() - currentDate.getDay())
			return `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
		}
		return currentDate.toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric',
		})
	}

	return (
		<CalendarNavigation
			view={view}
			currentDate={currentDate}
			onViewChange={setView}
			onDateChange={setCurrentDate}
			displayText={getDisplayText()}
		/>
	)
}

export const Default: Story = {
	render: () => <NavigationWrapper />,
}
