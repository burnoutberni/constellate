import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/hooks/queries'
import type { EventRecommendationPayload } from '@/types'
import { RecommendedEvents } from './RecommendedEvents'

// Mock recommendations data
const mockRecommendations: EventRecommendationPayload[] = [
	{
		event: {
			id: '1',
			title: 'Summer Music Festival',
			summary: 'A fantastic outdoor music festival',
			startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
			endTime: new Date(
				Date.now() + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000
			).toISOString(),
			location: 'Central Park, New York',
			timezone: 'America/New_York',
			visibility: 'PUBLIC',
			user: {
				id: 'user1',
				username: 'johndoe',
				name: 'John Doe',
				isRemote: false,
			},
			tags: [
				{ id: '1', tag: 'music' },
				{ id: '2', tag: 'festival' },
			],
		},
		score: 0.95,
		reasons: ['tag_match', 'host_match'],
		signals: {
			matchedTags: ['music', 'festival'],
			followedOrganizer: true,
			hostAffinity: true,
			popularityScore: 0.9,
		},
	},
	{
		event: {
			id: '2',
			title: 'Tech Meetup',
			summary: 'Monthly tech meetup for developers',
			startTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
			endTime: new Date(
				Date.now() + 14 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000
			).toISOString(),
			location: 'Tech Hub, San Francisco',
			timezone: 'America/Los_Angeles',
			visibility: 'PUBLIC',
			user: {
				id: 'user2',
				username: 'janedoe',
				name: 'Jane Doe',
				isRemote: false,
			},
			tags: [
				{ id: '3', tag: 'tech' },
				{ id: '4', tag: 'meetup' },
			],
		},
		score: 0.85,
		reasons: ['followed_user_attending'],
		signals: {
			matchedTags: ['tech'],
			followedOrganizer: false,
			hostAffinity: false,
			popularityScore: 0.8,
		},
	},
]

// Mock API call for recommendations
const originalGet = api.get.bind(api)
;(api.get as any) = async (url: string, params?: any) => {
	if (url === '/recommendations') {
		const limit = params?.limit || 6
		return {
			recommendations: limit === 3 ? mockRecommendations.slice(0, 3) : mockRecommendations,
			metadata: {
				generatedAt: new Date().toISOString(),
				signals: {
					tags: 2,
					hosts: 1,
					followed: 1,
				},
			},
		}
	}
	return originalGet(url, params)
}

// Create a function to set up the query client with mock data
const createQueryClient = () => {
	const client = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				// Use cached data and don't refetch
				staleTime: Infinity,
				cacheTime: Infinity,
			},
			mutations: { retry: false },
		},
	})

	// Set mock data for recommendations queries (for different limits)
	// Set the query data with status 'success' to prevent refetching
	const mockData6 = {
		recommendations: mockRecommendations,
		metadata: {
			generatedAt: new Date().toISOString(),
			signals: {
				tags: 2,
				hosts: 1,
				followed: 1,
			},
		},
	}

	const mockData3 = {
		recommendations: mockRecommendations.slice(0, 3),
		metadata: {
			generatedAt: new Date().toISOString(),
			signals: {
				tags: 2,
				hosts: 1,
				followed: 1,
			},
		},
	}

	// Set query data with status to prevent execution
	client.setQueryData(queryKeys.events.recommendations(6), mockData6)
	client.setQueryData(queryKeys.events.recommendations(3), mockData3)

	return client
}

const meta = {
	title: 'Components/RecommendedEvents',
	component: RecommendedEvents,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	args: {
		limit: 6,
	},
	decorators: [
		(Story) => {
			const queryClient = createQueryClient()
			return (
				<QueryClientProvider client={queryClient}>
					<MemoryRouter>
						<Story />
					</MemoryRouter>
				</QueryClientProvider>
			)
		},
	],
} satisfies Meta<typeof RecommendedEvents>

export default meta
type Story = StoryObj<typeof RecommendedEvents>

export const Default: Story = {
	args: {
		limit: 6,
	},
}

export const CustomLimit: Story = {
	args: {
		limit: 3,
	},
}
