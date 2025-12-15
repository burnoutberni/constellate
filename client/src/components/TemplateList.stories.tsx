import type { Meta, StoryObj } from '@storybook/react'
import { TemplateList, type EventTemplate } from './TemplateList'

const meta = {
	title: 'Components/TemplateList',
	component: TemplateList,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof TemplateList>

export default meta
type Story = StoryObj<typeof TemplateList>

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
		onEdit: (template) => console.log('Edit', template),
		onDelete: (id) => console.log('Delete', id),
		onPreview: (template) => console.log('Preview', template),
		onUse: (template) => console.log('Use', template),
	},
}

export const Loading: Story = {
	args: {
		templates: [],
		loading: true,
		onEdit: (template) => console.log('Edit', template),
		onDelete: (id) => console.log('Delete', id),
		onPreview: (template) => console.log('Preview', template),
		onUse: (template) => console.log('Use', template),
	},
}

export const Empty: Story = {
	args: {
		templates: [],
		loading: false,
		onEdit: (template) => console.log('Edit', template),
		onDelete: (id) => console.log('Delete', id),
		onPreview: (template) => console.log('Preview', template),
		onUse: (template) => console.log('Use', template),
	},
}
