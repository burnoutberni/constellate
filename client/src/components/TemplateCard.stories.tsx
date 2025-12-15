import type { Meta, StoryObj } from '@storybook/react'
import { TemplateCard, type EventTemplate } from './TemplateCard'

const meta = {
	title: 'Components/TemplateCard',
	component: TemplateCard,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof TemplateCard>

export default meta
type Story = StoryObj<typeof TemplateCard>

const mockTemplate: EventTemplate = {
	id: '1',
	name: 'Weekly Meetup',
	description: 'Template for weekly team meetings',
	data: {
		title: 'Team Standup',
		summary: 'Weekly team synchronization meeting',
		location: 'Conference Room A',
		startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
		url: 'https://meet.example.com/standup',
	},
	createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
	updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
}

const minimalTemplate: EventTemplate = {
	id: '2',
	name: 'Simple Event',
	description: null,
	data: {
		title: 'Quick Event',
	},
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
}

export const Default: Story = {
	args: {
		template: mockTemplate,
		onEdit: (template) => console.log('Edit', template),
		onDelete: (id) => console.log('Delete', id),
		onPreview: (template) => console.log('Preview', template),
		onUse: (template) => console.log('Use', template),
	},
}

export const Minimal: Story = {
	args: {
		template: minimalTemplate,
		onEdit: (template) => console.log('Edit', template),
		onDelete: (id) => console.log('Delete', id),
		onPreview: (template) => console.log('Preview', template),
		onUse: (template) => console.log('Use', template),
	},
}

export const Grid: Story = {
	render: () => (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			<TemplateCard
				template={mockTemplate}
				onEdit={(t) => console.log('Edit', t)}
				onDelete={(id) => console.log('Delete', id)}
				onPreview={(t) => console.log('Preview', t)}
				onUse={(t) => console.log('Use', t)}
			/>
			<TemplateCard
				template={minimalTemplate}
				onEdit={(t) => console.log('Edit', t)}
				onDelete={(id) => console.log('Delete', id)}
				onPreview={(t) => console.log('Preview', t)}
				onUse={(t) => console.log('Use', t)}
			/>
			<TemplateCard
				template={{
					...mockTemplate,
					id: '3',
					name: 'Conference Template',
					description: 'Template for conference events',
				}}
				onEdit={(t) => console.log('Edit', t)}
				onDelete={(id) => console.log('Delete', id)}
				onPreview={(t) => console.log('Preview', t)}
				onUse={(t) => console.log('Use', t)}
			/>
		</div>
	),
	parameters: {
		layout: 'padded',
	},
}
