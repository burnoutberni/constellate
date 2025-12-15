import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import React, { useState } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { CreateEventModal } from './CreateEventModal'
import { Button } from './ui'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

// Interactive wrapper for Docs page
const InteractiveWrapper = (args: React.ComponentProps<typeof CreateEventModal>) => {
	const [isOpen, setIsOpen] = useState(true)

	if (!isOpen) {
		return (
			<div
				style={{
					position: 'relative',
					minHeight: '800px',
					height: '800px',
					width: '100%',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}>
				<Button onClick={() => setIsOpen(true)}>Open Modal</Button>
			</div>
		)
	}

	return (
		<div style={{ position: 'relative', minHeight: '800px', height: '800px', width: '100%' }}>
			<CreateEventModal
				{...args}
				isOpen={isOpen}
				onClose={() => setIsOpen(false)}
				onSuccess={() => {
					console.log('Success')
					setIsOpen(false)
				}}
			/>
		</div>
	)
}

const meta = {
	title: 'Components/CreateEventModal',
	component: CreateEventModal,
	parameters: {
		layout: 'fullscreen',
		docs: {
			canvas: {
				height: '800px',
			},
		},
	},
	tags: ['autodocs'],
	args: {
		isOpen: false,
		onClose: () => {},
		onSuccess: () => {},
	},
	argTypes: {
		onClose: {
			control: false,
		},
		onSuccess: {
			control: false,
		},
	},
	decorators: [
		(Story) => (
			<AuthProvider>
				<QueryClientProvider client={queryClient}>
					<MemoryRouter>
						<Story />
					</MemoryRouter>
				</QueryClientProvider>
			</AuthProvider>
		),
	],
} satisfies Meta<typeof CreateEventModal>

export default meta
type Story = StoryObj<typeof CreateEventModal>

const ModalWrapper = () => {
	const [isOpen, setIsOpen] = useState(false)
	return (
		<>
			<Button onClick={() => setIsOpen(true)}>Create Event</Button>
			<CreateEventModal
				isOpen={isOpen}
				onClose={() => setIsOpen(false)}
				onSuccess={() => {
					console.log('Success')
					setIsOpen(false)
				}}
			/>
		</>
	)
}

export const Default: Story = {
	render: (args) => <InteractiveWrapper {...args} />,
	parameters: {
		docs: {
			story: {
				inline: true,
			},
		},
	},
}
