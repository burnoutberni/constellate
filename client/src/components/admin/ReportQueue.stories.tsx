import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ReportQueue } from './ReportQueue'

const meta: Meta<typeof ReportQueue> = {
	title: 'Admin/ReportQueue',
	component: ReportQueue,
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
type Story = StoryObj<typeof ReportQueue>

export const Default: Story = {
	parameters: {
		mockData: [
			{
				url: '/reports?status=pending',
				method: 'GET',
				status: 200,
				response: {
					reports: [
						{
							id: 'report-1',
							reporterId: 'user-1',
							reportedUserId: 'user-2',
							contentUrl: 'user:user-2',
							reason: 'Harassment in comments',
							category: 'harassment',
							status: 'pending',
							createdAt: new Date().toISOString(),
							reporter: {
								username: 'concerned_citizen',
							},
						},
						{
							id: 'report-2',
							reporterId: 'user-3',
							contentUrl: 'event:event-1',
							reason: 'This event is spam',
							category: 'spam',
							status: 'pending',
							createdAt: new Date().toISOString(),
							reporter: {
								username: 'event_police',
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
				url: '/reports?status=pending',
				method: 'GET',
				status: 200,
				response: {
					reports: [],
				},
			},
		],
	},
}

export const Loading: Story = {
	parameters: {
		mockData: [
			{
				url: '/reports?status=pending',
				method: 'GET',
				status: 200,
				response: {},
				delay: 2000,
			},
		],
	},
}
