import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { ReminderSelector } from './ReminderSelector'

const meta = {
	title: 'Components/ReminderSelector',
	component: ReminderSelector,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	args: {
		value: null,
		onChange: () => {},
		isAuthenticated: true,
		canManageReminder: true,
		isPending: false,
		eventHasStarted: false,
	},
	argTypes: {
		onChange: {
			control: false,
		},
	},
} satisfies Meta<typeof ReminderSelector>

export default meta
type Story = StoryObj<typeof ReminderSelector>

const SelectorWrapper = () => {
	const [value, setValue] = useState<number | null>(30)
	return (
		<ReminderSelector
			value={value}
			onChange={setValue}
			isAuthenticated={true}
			canManageReminder={true}
			isPending={false}
			eventHasStarted={false}
		/>
	)
}

export const Default: Story = {
	render: () => <SelectorWrapper />,
}

export const NotAuthenticated: Story = {
	args: {
		value: null,
		onChange: (v) => console.log('Change', v),
		isAuthenticated: false,
		canManageReminder: false,
		isPending: false,
		eventHasStarted: false,
	},
}

export const CannotManage: Story = {
	args: {
		value: null,
		onChange: (v) => console.log('Change', v),
		isAuthenticated: true,
		canManageReminder: false,
		isPending: false,
		eventHasStarted: false,
	},
}

export const Pending: Story = {
	args: {
		value: 30,
		onChange: (v) => console.log('Change', v),
		isAuthenticated: true,
		canManageReminder: true,
		isPending: true,
		eventHasStarted: false,
	},
}

export const EventStarted: Story = {
	args: {
		value: null,
		onChange: (v) => console.log('Change', v),
		isAuthenticated: true,
		canManageReminder: true,
		isPending: false,
		eventHasStarted: true,
	},
}
