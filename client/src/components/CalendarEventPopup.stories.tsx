import type { Meta, StoryObj } from '@storybook/react'
import React, { useState } from 'react'
import { CalendarEventPopup } from './CalendarEventPopup'
import { Button } from './ui'
import type { Event } from '@/types'

const mockEvent: Event = {
	id: '1',
	title: 'Summer Music Festival',
	summary: 'A fantastic outdoor music festival',
	startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
	endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
	location: 'Central Park, New York',
	url: 'https://example.com/festival',
	visibility: 'PUBLIC',
	user: {
		id: 'user1',
		username: 'johndoe',
		name: 'John Doe',
		profileImage: 'https://i.pravatar.cc/150?img=12',
	},
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
}

// Interactive preview for Docs page - renders popup open by default
const DocsWrapper = (args: React.ComponentProps<typeof CalendarEventPopup>) => {
	const [isOpen, setIsOpen] = useState(true)

	if (!isOpen) {
		return (
			<div
				style={{
					position: 'relative',
					minHeight: '500px',
					height: '500px',
					width: '100%',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}>
				<Button onClick={() => setIsOpen(true)}>Open Popup</Button>
			</div>
		)
	}

	return (
		<div
			style={{
				position: 'relative',
				minHeight: '500px',
				height: '500px',
				width: '100%',
			}}>
			<CalendarEventPopup
				{...args}
				position={{ x: 100, y: 100 }}
				onClose={() => setIsOpen(false)}
			/>
		</div>
	)
}

const meta = {
	title: 'Components/CalendarEventPopup',
	component: CalendarEventPopup,
	parameters: {
		layout: 'fullscreen',
		docs: {
			canvas: {
				height: '500px',
			},
			story: {
				inline: false,
			},
		},
	},
	tags: ['autodocs'],
	args: {
		event: mockEvent,
		position: { x: 100, y: 100 },
		onClose: () => {},
		onNavigateToEvent: () => {},
		onExportICS: () => {},
		onExportGoogle: () => {},
	},
	argTypes: {
		onClose: {
			control: false,
		},
		onNavigateToEvent: {
			control: false,
		},
		onExportICS: {
			control: false,
		},
		onExportGoogle: {
			control: false,
		},
	},
} satisfies Meta<typeof CalendarEventPopup>

export default meta
type Story = StoryObj<typeof CalendarEventPopup>

const PopupWrapper = () => {
	const [isOpen, setIsOpen] = useState(false)
	return (
		<>
			<Button onClick={() => setIsOpen(true)}>Open Popup</Button>
			{isOpen && (
				<CalendarEventPopup
					event={mockEvent}
					position={{ x: 400, y: 200 }}
					onClose={() => setIsOpen(false)}
					onNavigateToEvent={(id) => {
						console.log('Navigate to', id)
						setIsOpen(false)
					}}
					onExportICS={(id) => console.log('Export ICS', id)}
					onExportGoogle={(id) => console.log('Export Google', id)}
				/>
			)}
		</>
	)
}

export const Default: Story = {
	render: DocsWrapper,
	parameters: {
		docs: {
			story: {
				inline: true,
			},
		},
	},
}

export const Interactive: Story = {
	render: () => <PopupWrapper />,
}
