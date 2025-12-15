import type { Meta, StoryObj } from '@storybook/react'
import { TemplateSelector, type EventTemplate } from './TemplateSelector'

const meta = {
	title: 'Components/TemplateSelector',
	component: TemplateSelector,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof TemplateSelector>

export default meta
type Story = StoryObj<typeof TemplateSelector>

const mockTemplates: EventTemplate[] = [
	{
		id: '1',
		name: 'Weekly Meetup',
		description: 'Template for weekly team meetings',
		data: {
			title: 'Team Standup',
			summary: 'Weekly team synchronization',
			location: 'Conference Room A',
		},
	},
	{
		id: '2',
		name: 'Conference Event',
		description: 'Template for conference events',
		data: {
			title: 'Tech Conference',
			summary: 'Annual technology conference',
			location: 'Convention Center',
		},
	},
	{
		id: '3',
		name: 'Workshop',
		description: 'Template for workshops',
		data: {
			title: 'Design Workshop',
			summary: 'Interactive design workshop',
		},
	},
]

export const Default: Story = {
	args: {
		templates: mockTemplates,
		selectedId: '1',
		onSelect: (id) => console.log('Select', id),
		onRefresh: () => console.log('Refresh'),
	},
}

export const Loading: Story = {
	args: {
		templates: [],
		selectedId: '',
		loading: true,
		onSelect: (id) => console.log('Select', id),
		onRefresh: () => console.log('Refresh'),
	},
}

export const Error: Story = {
	args: {
		templates: [],
		selectedId: '',
		error: 'Failed to load templates',
		onSelect: (id) => console.log('Select', id),
		onRefresh: () => console.log('Refresh'),
	},
}

export const Empty: Story = {
	args: {
		templates: [],
		selectedId: '',
		onSelect: (id) => console.log('Select', id),
		onRefresh: () => console.log('Refresh'),
	},
}
