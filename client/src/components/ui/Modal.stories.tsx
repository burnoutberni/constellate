import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

const meta = {
	title: 'Base/Modal',
	component: Modal,
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
		onClose: () => {},
		children: 'Modal content',
	},
	argTypes: {
		maxWidth: {
			control: 'select',
			options: ['sm', 'md', 'lg', 'xl', '2xl', 'full'],
		},
		animated: {
			control: 'boolean',
		},
		closeOnBackdropClick: {
			control: 'boolean',
		},
		closeOnEscape: {
			control: 'boolean',
		},
		isOpen: {
			control: false,
		},
		onClose: {
			control: false,
		},
	},
} satisfies Meta<typeof Modal>

export default meta
type Story = StoryObj<typeof Modal>

const ModalWrapper = ({ children, ...props }: React.ComponentProps<typeof Modal>) => {
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
			<Modal {...props} isOpen={isOpen} onClose={() => setIsOpen(false)}>
				{children}
			</Modal>
		</div>
	)
}

export const Default: Story = {
	render: () => (
		<ModalWrapper>
			<div className="p-6">
				<h2 className="text-xl font-semibold mb-4">Modal Title</h2>
				<p className="text-text-secondary mb-4">This is the modal content.</p>
				<Button onClick={() => {}}>Close</Button>
			</div>
		</ModalWrapper>
	),
	parameters: {
		docs: {
			story: {
				inline: true,
			},
		},
	},
}

export const Small: Story = {
	render: () => (
		<ModalWrapper maxWidth="sm">
			<div className="p-6">
				<h2 className="text-xl font-semibold mb-4">Small Modal</h2>
				<p className="text-text-secondary">This is a small modal.</p>
			</div>
		</ModalWrapper>
	),
}

export const Large: Story = {
	render: () => (
		<ModalWrapper maxWidth="lg">
			<div className="p-6">
				<h2 className="text-xl font-semibold mb-4">Large Modal</h2>
				<p className="text-text-secondary">This is a large modal with more space.</p>
			</div>
		</ModalWrapper>
	),
}

export const ExtraLarge: Story = {
	render: () => (
		<ModalWrapper maxWidth="2xl">
			<div className="p-6">
				<h2 className="text-xl font-semibold mb-4">Extra Large Modal</h2>
				<p className="text-text-secondary">This is an extra large modal.</p>
			</div>
		</ModalWrapper>
	),
}

export const WithHeaderAndFooter: Story = {
	render: () => (
		<ModalWrapper>
			<div className="p-6">
				<h2 className="text-xl font-semibold mb-4">Modal with Header and Footer</h2>
				<p className="text-text-secondary mb-6">
					This modal has a header and footer section for better organization.
				</p>
				<div className="flex justify-end gap-2 pt-4 border-t border-border-default">
					<Button variant="secondary" onClick={() => {}}>
						Cancel
					</Button>
					<Button onClick={() => {}}>Confirm</Button>
				</div>
			</div>
		</ModalWrapper>
	),
}

export const NoBackdropClose: Story = {
	render: () => (
		<ModalWrapper closeOnBackdropClick={false}>
			<div className="p-6">
				<h2 className="text-xl font-semibold mb-4">Modal Without Backdrop Close</h2>
				<p className="text-text-secondary mb-4">
					Click outside won't close this modal. Use the close button or Escape key.
				</p>
				<Button onClick={() => {}}>Close</Button>
			</div>
		</ModalWrapper>
	),
}

export const NoEscapeClose: Story = {
	render: () => (
		<ModalWrapper closeOnEscape={false}>
			<div className="p-6">
				<h2 className="text-xl font-semibold mb-4">Modal Without Escape Close</h2>
				<p className="text-text-secondary mb-4">
					Escape key won't close this modal. Use the close button or click outside.
				</p>
				<Button onClick={() => {}}>Close</Button>
			</div>
		</ModalWrapper>
	),
}

export const NoAnimation: Story = {
	render: () => (
		<ModalWrapper animated={false}>
			<div className="p-6">
				<h2 className="text-xl font-semibold mb-4">Modal Without Animation</h2>
				<p className="text-text-secondary">This modal appears without animation.</p>
			</div>
		</ModalWrapper>
	),
}
