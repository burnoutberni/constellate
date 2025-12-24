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
;(api.get as typeof api.get) = async <T,>(
	url: string,
	queryParams?: Record<string, string | number | boolean | undefined>,
	options?: RequestInit,
	baseErrorMessage?: string
): Promise<T> => {
	if (url === '/search/suggestions') {
		// Return mock suggestions based on query
		const query = (queryParams?.q as string) || ''
		return {
			tags: [
				{ tag: 'music', count: 42 },
				{ tag: 'festival', count: 28 },
				{ tag: 'concert', count: 15 },
			].filter((tag) => tag.tag.includes(query.toLowerCase())),
			locations: ['New York', 'San Francisco', 'Los Angeles'].filter((loc) =>
				loc.toLowerCase().includes(query.toLowerCase())
			),
		} as T
	}
	return originalGet<T>(url, queryParams, options, baseErrorMessage)
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
		onSelect: (_suggestion) => {
			// Select handler
		},
	},
}

export const ShortQuery: Story = {
	args: {
		query: 'm',
		onSelect: (_suggestion) => {
			// Select handler
		},
	},
}

export const EmptyQuery: Story = {
	args: {
		query: '',
		onSelect: (_suggestion) => {
			// Select handler
		},
	},
}
