import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import { ThemeProvider } from '@/design-system'

import { AppealModal } from './AppealModal'
import { Button } from './ui'

// Mock API client
vi.mock('@/lib/api-client', () => ({
	api: {
		post: vi.fn().mockResolvedValue({}),
	},
}))

// Mock UI store
vi.mock('@/stores', () => ({
	useUIStore: () => ({
		addToast: vi.fn(),
	}),
}))

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

function InteractiveWrapper() {
	const [isOpen, setIsOpen] = useState(false)

	return (
		<div className="p-4">
			<Button onClick={() => setIsOpen(true)}>Open Appeal Modal</Button>
			<AppealModal
				isOpen={isOpen}
				onClose={() => setIsOpen(false)}
				onSuccess={() => setIsOpen(false)}
			/>
		</div>
	)
}

const meta = {
	title: 'Components/AppealModal',
	component: AppealModal,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<ThemeProvider defaultTheme="LIGHT">
				<QueryClientProvider client={queryClient}>
					<MemoryRouter>
						<Story />
					</MemoryRouter>
				</QueryClientProvider>
			</ThemeProvider>
		),
	],
} satisfies Meta<typeof AppealModal>

export default meta
type Story = StoryObj<typeof AppealModal>

export const Default: Story = {
	render: () => <InteractiveWrapper />,
}

function WithReferenceWrapper() {
	const [isOpen, setIsOpen] = useState(false)
	return (
		<div className="p-4">
			<Button onClick={() => setIsOpen(true)}>Open Appeal Modal with Reference</Button>
			<AppealModal
				isOpen={isOpen}
				onClose={() => setIsOpen(false)}
				onSuccess={() => setIsOpen(false)}
				referenceId="report_123"
				referenceType="report"
			/>
		</div>
	)
}

export const WithReference: Story = {
	render: () => <WithReferenceWrapper />,
}
