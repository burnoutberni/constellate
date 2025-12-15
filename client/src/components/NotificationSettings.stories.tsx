import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { NotificationSettings } from './NotificationSettings'

const meta = {
	title: 'Components/NotificationSettings',
	component: NotificationSettings,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	args: {
		preferences: {},
		onUpdate: () => {},
		loading: false,
	},
	argTypes: {
		onUpdate: {
			control: false,
		},
	},
} satisfies Meta<typeof NotificationSettings>

export default meta
type Story = StoryObj<typeof NotificationSettings>

const SettingsWrapper = () => {
	const [preferences, setPreferences] = useState<Record<string, boolean>>({
		FOLLOW: true,
		COMMENT: true,
		LIKE: false,
		MENTION: true,
		EVENT: true,
		SYSTEM: true,
	})

	return (
		<NotificationSettings
			preferences={preferences}
			onUpdate={(newPrefs) => {
				console.log('Update preferences:', newPrefs)
				setPreferences(newPrefs)
			}}
		/>
	)
}

export const Default: Story = {
	render: () => <SettingsWrapper />,
}

export const Loading: Story = {
	args: {
		loading: true,
	},
}

export const Empty: Story = {
	args: {
		preferences: {},
		onUpdate: (prefs) => console.log('Update', prefs),
	},
}
