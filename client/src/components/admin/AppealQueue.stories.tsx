import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AppealQueue } from './AppealQueue'

const meta: Meta<typeof AppealQueue> = {
	title: 'Admin/AppealQueue',
	component: AppealQueue,
	parameters: {
		layout: 'padded',
	},
	decorators: [
		(Story) => {
			const queryClient = new QueryClient({
				defaultOptions: {
					queries: {
						retry: false,
					},
				},
			})
			return (
				<QueryClientProvider client={queryClient}>
					<Story />
				</QueryClientProvider>
			)
		},
	],
}

export default meta
type Story = StoryObj<typeof AppealQueue>

export const Default: Story = {
	parameters: {
		mockData: [
			{
				url: '/admin/appeals?status=pending',
				method: 'GET',
				status: 200,
				response: {
					appeals: [
						{
							id: 'appeal-1',
							userId: 'user-1',
							type: 'CONTENT_REMOVAL',
							reason: 'I believe my content was removed in error. It follows the guidelines.',
							status: 'PENDING',
							createdAt: new Date().toISOString(),
							user: {
								username: 'innocent_user',
							},
						},
						{
							id: 'appeal-2',
							userId: 'user-2',
							type: 'ACCOUNT_SUSPENSION',
							reason: 'Please unsuspend my account. I was hacked.',
							status: 'PENDING',
							createdAt: new Date().toISOString(),
							user: {
								username: 'hacked_user',
							},
						},
					],
				},
			},
		],
	},
}

export const Empty: Story = {
	parameters: {
		mockData: [
			{
				url: '/admin/appeals?status=pending',
				method: 'GET',
				status: 200,
				response: {
					appeals: [],
				},
			},
		],
	},
}

export const Loading: Story = {
	parameters: {
		mockData: [
			{
				url: '/admin/appeals?status=pending',
				method: 'GET',
				status: 200,
				response: {},
				delay: 2000,
			},
		],
	},
}
