import type { Meta, StoryObj } from '@storybook/react'
import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { ConfirmationModal } from './ConfirmationModal'
import { Button } from './ui'

// Interactive wrapper for Docs page
const InteractiveWrapper = (args: React.ComponentProps<typeof ConfirmationModal>) => {
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
				<Button onClick={() => setIsOpen(true)}>Open Modal</Button>
			</div>
		)
	}

	return (
		<div style={{ position: 'relative', minHeight: '500px', height: '500px', width: '100%' }}>
			{typeof document !== 'undefined' &&
				createPortal(
					<ConfirmationModal
						{...args}
						isOpen={isOpen}
						onCancel={() => setIsOpen(false)}
						onConfirm={() => {
							console.log('Confirmed')
							setIsOpen(false)
						}}
					/>,
					document.body
				)}
		</div>
	)
}

const meta = {
	title: 'Components/ConfirmationModal',
	component: ConfirmationModal,
	parameters: {
		layout: 'fullscreen',
		docs: {
			canvas: {
				height: '500px',
			},
		},
	},
	tags: ['autodocs'],
	args: {
		isOpen: false,
		title: 'Confirm Action',
		message: 'Are you sure you want to proceed?',
		onConfirm: () => {},
		onCancel: () => {},
	},
	argTypes: {
		onConfirm: {
			control: false,
		},
		onCancel: {
			control: false,
		},
	},
} satisfies Meta<typeof ConfirmationModal>

export default meta
type Story = StoryObj<typeof ConfirmationModal>

const ModalWrapper = (
	props: Omit<
		React.ComponentProps<typeof ConfirmationModal>,
		'isOpen' | 'onCancel' | 'onConfirm'
	> & { variant?: 'danger' | 'default'; confirmLabel?: string; cancelLabel?: string }
) => {
	const [isOpen, setIsOpen] = useState(false)
	return (
		<>
			<Button onClick={() => setIsOpen(true)}>Open Modal</Button>
			<ConfirmationModal
				{...props}
				isOpen={isOpen}
				onCancel={() => setIsOpen(false)}
				onConfirm={() => setIsOpen(false)}
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

export const Danger: Story = {
	render: () => (
		<ModalWrapper
			title="Delete Event"
			message="This action cannot be undone. Are you sure you want to delete this event?"
			variant="danger"
			confirmLabel="Delete"
		/>
	),
}

export const CustomLabels: Story = {
	render: () => (
		<ModalWrapper
			title="Save Changes"
			message="You have unsaved changes. Do you want to save them before leaving?"
			confirmLabel="Save"
			cancelLabel="Discard"
		/>
	),
}

export const Pending: Story = {
	render: () => {
		const [isOpen, setIsOpen] = useState(false)
		const [isPending, setIsPending] = useState(false)

		const handleConfirm = async () => {
			setIsPending(true)
			// Simulate async operation
			await new Promise((resolve) => setTimeout(resolve, 2000))
			setIsPending(false)
			setIsOpen(false)
		}

		return (
			<>
				<Button onClick={() => setIsOpen(true)}>Open Modal</Button>
				<ConfirmationModal
					isOpen={isOpen}
					title="Processing Request"
					message="This may take a few seconds..."
					onCancel={() => setIsOpen(false)}
					onConfirm={handleConfirm}
					isPending={isPending}
				/>
			</>
		)
	},
}
