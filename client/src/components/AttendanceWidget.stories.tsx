import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import { AttendanceWidget } from './AttendanceWidget'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: false,
		},
	},
})

const meta = {
	title: 'Components/AttendanceWidget',
	component: AttendanceWidget,
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
} satisfies Meta<typeof AttendanceWidget>

export default meta
type Story = StoryObj<typeof AttendanceWidget>

export const Default: Story = {
	args: {
		userAttendance: null,
		attendingCount: 42,
		maybeCount: 5,
		likeCount: 128,
		userLiked: false,
		userHasShared: false,
		isAuthenticated: true,
		isLikePending: false,
		isSharePending: false,

		onLike: () => {
			// Like handler
		},
		onShare: () => {
			// Share handler
		},
	},
}

export const Attending: Story = {
	args: {
		userAttendance: 'attending',
		attendingCount: 43,
		maybeCount: 5,
		likeCount: 128,
		userLiked: false,
		userHasShared: false,
		isAuthenticated: true,
		isLikePending: false,
		isSharePending: false,

		onLike: () => {
			// Like handler
		},
		onShare: () => {
			// Share handler
		},
	},
}

export const Maybe: Story = {
	args: {
		userAttendance: 'maybe',
		attendingCount: 42,
		maybeCount: 6,
		likeCount: 128,
		userLiked: false,
		userHasShared: false,
		isAuthenticated: true,
		isLikePending: false,
		isSharePending: false,

		onLike: () => {
			// Like handler
		},
		onShare: () => {
			// Share handler
		},
	},
}

export const Liked: Story = {
	args: {
		userAttendance: null,
		attendingCount: 42,
		maybeCount: 5,
		likeCount: 129,
		userLiked: true,
		userHasShared: false,
		isAuthenticated: true,
		isLikePending: false,
		isSharePending: false,

		onLike: () => {
			// Like handler
		},
		onShare: () => {
			// Share handler
		},
	},
}

export const NotAuthenticated: Story = {
	args: {
		userAttendance: null,
		attendingCount: 42,
		maybeCount: 5,
		likeCount: 128,
		userLiked: false,
		userHasShared: false,
		isAuthenticated: false,
		isLikePending: false,
		isSharePending: false,

		onLike: () => {
			// Like handler
		},
		onShare: () => {
			// Share handler
		},
	},
}

export const Pending: Story = {
	args: {
		userAttendance: null,
		attendingCount: 42,
		maybeCount: 5,
		likeCount: 128,
		userLiked: false,
		userHasShared: false,
		isAuthenticated: true,
		isLikePending: false,
		isSharePending: false,

		onLike: () => {
			// Like handler
		},
		onShare: () => {
			// Share handler
		},
	},
}
