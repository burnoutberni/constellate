import type { Meta, StoryObj } from '@storybook/react'

import { type EventTemplate } from './TemplateCard'
import { TemplateList } from './TemplateList'

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
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
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
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	},
	{
		id: '3',
		name: 'Workshop',
		description: 'Template for workshops',
		data: {
			title: 'Design Workshop',
			summary: 'Interactive design workshop',
		},
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	},
]

export const Default: Story = {
	args: {
		templates: mockTemplates,
		onEdit: (_template) => {
			// Edit handler
		},
		onDelete: (_id) => {
			// Delete handler
		},
		onPreview: (_template) => {
			// Preview handler
		},
		onUse: (_template) => {
			// Use handler
		},
	},
}

export const Loading: Story = {
	args: {
		templates: [],
		loading: true,
		onEdit: (_template) => {
			// Edit handler
		},
		onDelete: (_id) => {
			// Delete handler
		},
		onPreview: (_template) => {
			// Preview handler
		},
		onUse: (_template) => {
			// Use handler
		},
	},
}

export const Empty: Story = {
	args: {
		templates: [],
		loading: false,
		onEdit: (_template) => {
			// Edit handler
		},
		onDelete: (_id) => {
			// Delete handler
		},
		onPreview: (_template) => {
			// Preview handler
		},
		onUse: (_template) => {
			// Use handler
		},
	},
}
