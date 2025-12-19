import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'

import { ThemeProvider } from '@/design-system'
import { api } from '@/lib/api-client'
import type { User } from '@/types'

import { FollowersModal } from './FollowersModal'
import { Button } from './ui'

// Mock API call for followers/following
const originalGet = api.get.bind(api)
;(api.get as typeof api.get) = async <T,>(
	url: string,
	queryParams?: Record<string, string | number | boolean | undefined>,
	options?: RequestInit,
	baseErrorMessage?: string
): Promise<T> => {
	if (
		url.includes('/user-search/profile/') &&
		(url.includes('/followers') || url.includes('/following'))
	) {
		const mockUsers: User[] = [
			{
				id: 'user1',
				username: 'alice',
				name: 'Alice Smith',
				email: 'alice@example.com',
				profileImage: 'https://i.pravatar.cc/150?img=1',
				isRemote: false,
				createdAt: new Date().toISOString(),
				displayColor: '#3b82f6',
				timezone: 'America/New_York',
				isPublicProfile: true,
			},
			{
				id: 'user2',
				username: 'bob',
				name: 'Bob Johnson',
				email: 'bob@example.com',
				profileImage: null,
				displayColor: '#3b82f6',
				isRemote: false,
				createdAt: new Date().toISOString(),
				timezone: 'America/New_York',
				isPublicProfile: true,
			},
			{
				id: 'user3',
				username: 'charlie',
				name: 'Charlie Brown',
				email: 'charlie@example.com',
				profileImage: 'https://i.pravatar.cc/150?img=3',
				isRemote: true,
				createdAt: new Date().toISOString(),
				displayColor: '#3b82f6',
				timezone: 'America/New_York',
				isPublicProfile: true,
			},
		]
		if (url.includes('/followers')) {
			return { followers: mockUsers } as T
		}
		return { following: mockUsers } as T
	}
	return originalGet<T>(url, queryParams, options, baseErrorMessage)
}

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

// Interactive wrapper for Docs page
const InteractiveWrapper = (args: React.ComponentProps<typeof FollowersModal>) => {
	const [isOpen, setIsOpen] = useState(true)

	if (!isOpen) {
		return (
			<div
				style={{
					position: 'relative',
					minHeight: '400px',
					height: '400px',
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
		<div style={{ position: 'relative', minHeight: '400px', width: '100%' }}>
			<FollowersModal {...args} isOpen={isOpen} onClose={() => setIsOpen(false)} />
		</div>
	)
}

const meta = {
	title: 'Components/FollowersModal',
	component: FollowersModal,
	parameters: {
		layout: 'fullscreen',
		docs: {
			canvas: {
				height: '400px',
			},
			story: {
				inline: false,
				iframeHeight: 400,
			},
		},
	},
	tags: ['autodocs'],
	args: {
		isOpen: false,
		onClose: () => {},
		username: 'johndoe',
		type: 'followers',
	},
	argTypes: {
		onClose: {
			control: false,
		},
	},
	decorators: [
		(Story) => (
			<ThemeProvider>
				<QueryClientProvider client={queryClient}>
					<MemoryRouter>
						<Story />
					</MemoryRouter>
				</QueryClientProvider>
			</ThemeProvider>
		),
	],
} satisfies Meta<typeof FollowersModal>

export default meta
type Story = StoryObj<typeof FollowersModal>

const ModalWrapper = ({ type }: { type: 'followers' | 'following' }) => {
	const [isOpen, setIsOpen] = useState(true)
	return (
		<div style={{ position: 'relative', minHeight: '400px', width: '100%' }}>
			<FollowersModal
				isOpen={isOpen}
				onClose={() => setIsOpen(false)}
				username="johndoe"
				type={type}
			/>
		</div>
	)
}

export const Followers: Story = {
	render: () => <ModalWrapper type="followers" />,
}

export const Following: Story = {
	render: () => <ModalWrapper type="following" />,
}

export const Default: Story = {
	render: (args) => <InteractiveWrapper {...args} />,
	parameters: {
		layout: 'padded',
		docs: {
			story: {
				inline: false,
				iframeHeight: 400,
			},
		},
	},
}
