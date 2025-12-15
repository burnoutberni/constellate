import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

import { MiniCalendar } from './MiniCalendar'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: false,
			staleTime: Infinity, // Prevent refetching to avoid async updates
			gcTime: Infinity, // Prevent cache cleanup
			refetchOnMount: false,
			refetchOnWindowFocus: false,
			refetchOnReconnect: false,
		},
		mutations: { retry: false },
	},
})

const meta = {
	title: 'Components/MiniCalendar',
	component: MiniCalendar,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	args: {
		selectedDate: new Date(),
		onDateSelect: () => {},
	},
	argTypes: {
		onDateSelect: {
			control: false,
		},
	},
	decorators: [
		(Story) => (
			<QueryClientProvider client={queryClient}>
				<Story />
			</QueryClientProvider>
		),
	],
} satisfies Meta<typeof MiniCalendar>

export default meta
type Story = StoryObj<typeof MiniCalendar>

const CalendarWrapper = () => {
	const [selectedDate, setSelectedDate] = useState(new Date())
	return <MiniCalendar selectedDate={selectedDate} onDateSelect={setSelectedDate} />
}

export const Default: Story = {
	render: () => <CalendarWrapper />,
}
