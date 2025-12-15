import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { CommentThread } from './CommentThread'
import type { CommentWithMentions } from '@/types'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

const meta = {
	title: 'Components/CommentThread',
	component: CommentThread,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<QueryClientProvider client={queryClient}>
				<MemoryRouter>
					<Story />
				</MemoryRouter>
			</QueryClientProvider>
		),
	],
} satisfies Meta<typeof CommentThread>

export default meta
type Story = StoryObj<typeof CommentThread>

const mockComment: CommentWithMentions = {
	id: '1',
	content: 'This is a great event!',
	createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
	author: {
		id: 'user1',
		username: 'alice',
		name: 'Alice Smith',
		profileImage: 'https://i.pravatar.cc/150?img=1',
	},
	mentions: [],
}

export const Default: Story = {
	args: {
		comment: mockComment,
		currentUserId: 'user2',
		onReply: async (parentId, content) => {
			console.log('Reply to', parentId, ':', content)
		},
		onDelete: (id) => console.log('Delete', id),
	},
}

export const WithReplies: Story = {
	args: {
		comment: {
			...mockComment,
			replies: [
				{
					id: '2',
					content: 'I agree!',
					createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
					author: {
						id: 'user2',
						username: 'bob',
						name: 'Bob Johnson',
						profileImage: 'https://i.pravatar.cc/150?img=2',
					},
					mentions: [],
				},
			],
		},
		currentUserId: 'user3',
		onReply: async (parentId, content) => {
			console.log('Reply to', parentId, ':', content)
		},
	},
}

export const OwnComment: Story = {
	args: {
		comment: mockComment,
		currentUserId: 'user1',
		onDelete: (id) => console.log('Delete', id),
	},
}
