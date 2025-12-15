import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { CommentList } from './CommentList'
import type { CommentWithMentions } from '@/types'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

const meta = {
	title: 'Components/CommentList',
	component: CommentList,
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
} satisfies Meta<typeof CommentList>

export default meta
type Story = StoryObj<typeof CommentList>

const mockComments: CommentWithMentions[] = [
	{
		id: '1',
		content: 'This looks amazing!',
		createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
		author: {
			id: 'user1',
			username: 'alice',
			name: 'Alice Smith',
			profileImage: 'https://i.pravatar.cc/150?img=1',
		},
		mentions: [],
	},
	{
		id: '2',
		content: "Can't wait to attend!",
		createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
		author: {
			id: 'user2',
			username: 'bob',
			name: 'Bob Johnson',
			profileImage: 'https://i.pravatar.cc/150?img=2',
		},
		mentions: [],
	},
]

export const Default: Story = {
	args: {
		comments: mockComments,
		isAuthenticated: true,
		onAddComment: async (content) => {
			console.log('Add comment:', content)
		},
		onReply: async (parentId, content) => {
			console.log('Reply to', parentId, ':', content)
		},
		onDelete: (id) => console.log('Delete', id),
	},
}

export const Empty: Story = {
	args: {
		comments: [],
		isAuthenticated: true,
		onAddComment: async (content) => {
			console.log('Add comment:', content)
		},
	},
}

export const NotAuthenticated: Story = {
	args: {
		comments: mockComments,
		isAuthenticated: false,
		onSignUpPrompt: () => console.log('Sign up'),
	},
}

export const AddingComment: Story = {
	args: {
		comments: mockComments,
		isAuthenticated: true,
		isAddingComment: true,
		onAddComment: async (content) => {
			await new Promise((resolve) => setTimeout(resolve, 2000))
		},
	},
}
