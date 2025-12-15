import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { SearchSuggestions } from './SearchSuggestions'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

// Mock API responses for Storybook
const originalGet = api.get.bind(api)
;(api.get as any) = async (url: string, params?: any) => {
	if (url === '/search/suggestions') {
		// Return mock suggestions based on query
		const query = params?.q || ''
		return {
			tags: [
				{ tag: 'music', count: 42 },
				{ tag: 'festival', count: 28 },
				{ tag: 'concert', count: 15 },
			].filter((tag) => tag.tag.includes(query.toLowerCase())),
			locations: ['New York', 'San Francisco', 'Los Angeles'].filter((loc) =>
				loc.toLowerCase().includes(query.toLowerCase())
			),
		}
	}
	return originalGet(url, params)
}

// Mock localStorage for recent searches
if (typeof window !== 'undefined' && !localStorage.getItem('constellate_recent_searches')) {
	localStorage.setItem(
		'constellate_recent_searches',
		JSON.stringify(['music festival', 'tech meetup', 'art exhibition'])
	)
}

const meta = {
	title: 'Components/SearchSuggestions',
	component: SearchSuggestions,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<QueryClientProvider client={queryClient}>
				<Story />
			</QueryClientProvider>
		),
	],
} satisfies Meta<typeof SearchSuggestions>

export default meta
type Story = StoryObj<typeof SearchSuggestions>

export const Default: Story = {
	args: {
		query: 'music',
		onSelect: (suggestion) => console.log('Select', suggestion),
	},
}

export const ShortQuery: Story = {
	args: {
		query: 'm',
		onSelect: (suggestion) => console.log('Select', suggestion),
	},
}

export const EmptyQuery: Story = {
	args: {
		query: '',
		onSelect: (suggestion) => console.log('Select', suggestion),
	},
}
