import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'
import { CommentItem } from './CommentItem'
import type { CommentWithMentions } from '@/types'

const meta = {
	title: 'Components/CommentItem',
	component: CommentItem,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<MemoryRouter>
				<Story />
			</MemoryRouter>
		),
	],
} satisfies Meta<typeof CommentItem>

export default meta
type Story = StoryObj<typeof CommentItem>

const mockComment: CommentWithMentions = {
	id: '1',
	content: 'This is a great event! Looking forward to it.',
	createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
	author: {
		id: 'user1',
		username: 'johndoe',
		name: 'John Doe',
		profileImage: 'https://i.pravatar.cc/150?img=12',
	},
	mentions: [],
}

const mockCommentWithMention: CommentWithMentions = {
	...mockComment,
	content: 'Hey @janesmith, you should check this out!',
	mentions: [
		{
			id: 'mention1',
			handle: '@janesmith',
			user: {
				id: 'user2',
				username: 'janesmith',
				name: 'Jane Smith',
			},
		},
	],
}

const mockReply: CommentWithMentions = {
	...mockComment,
	id: '2',
	content: 'Thanks for sharing!',
	author: {
		id: 'user2',
		username: 'janesmith',
		name: 'Jane Smith',
		profileImage: 'https://i.pravatar.cc/150?img=47',
	},
}

export const Default: Story = {
	args: {
		comment: mockComment,
		currentUserId: 'user2',
	},
}

export const WithMention: Story = {
	args: {
		comment: mockCommentWithMention,
		currentUserId: 'user2',
	},
}

export const OwnComment: Story = {
	args: {
		comment: mockComment,
		currentUserId: 'user1',
		onDelete: (id) => console.log('Delete', id),
	},
}

export const WithReply: Story = {
	args: {
		comment: mockComment,
		currentUserId: 'user2',
		onReply: (id) => console.log('Reply to', id),
	},
}

export const NestedReply: Story = {
	args: {
		comment: mockReply,
		currentUserId: 'user1',
		depth: 1,
		onReply: (id) => console.log('Reply to', id),
	},
}

export const LongContent: Story = {
	args: {
		comment: {
			...mockComment,
			content:
				'This is a much longer comment that demonstrates how the component handles longer text content. It should wrap properly and maintain good readability.',
		},
		currentUserId: 'user2',
	},
}

export const MultipleComments: Story = {
	render: () => (
		<div className="space-y-4 max-w-2xl">
			<CommentItem comment={mockComment} currentUserId="user2" />
			<CommentItem comment={mockCommentWithMention} currentUserId="user2" />
			<CommentItem comment={mockReply} currentUserId="user1" depth={1} />
		</div>
	),
	parameters: {
		layout: 'padded',
	},
}
