import type { Meta, StoryObj } from '@storybook/react'
import React, { useState } from 'react'

import { MentionAutocomplete, type MentionSuggestion } from './MentionAutocomplete'
import { Input } from './ui'

const mockSuggestions: MentionSuggestion[] = [
	{
		id: '1',
		username: 'alice',
		name: 'Alice Smith',
		profileImage: 'https://i.pravatar.cc/150?img=1',
	},
	{
		id: '2',
		username: 'bob',
		name: 'Bob Johnson',
		profileImage: 'https://i.pravatar.cc/150?img=2',
	},
	{
		id: '3',
		username: 'charlie',
		name: 'Charlie Brown',
		profileImage: null,
		displayColor: '#3b82f6',
	},
	{
		id: '4',
		username: 'diana',
		name: 'Diana Prince',
		profileImage: 'https://i.pravatar.cc/150?img=4',
	},
	{
		id: '5',
		username: 'eve',
		name: 'Eve Adams',
		profileImage: null,
		displayColor: '#10b981',
	},
]

// Interactive wrapper for Docs page
const InteractiveWrapper = (args: React.ComponentProps<typeof MentionAutocomplete>) => {
	const [_activeIndex, _setActiveIndex] = useState(0)
	return (
		<div
			className="relative w-full max-w-md"
			style={{ minHeight: '300px', paddingTop: '60px' }}>
			<Input placeholder="Type @ to mention someone" value="@" readOnly className="mb-2" />
			<MentionAutocomplete
				{...args}
				activeIndex={_activeIndex}
				onSelect={(_suggestion) => {
					// Select handler
				}}
			/>
		</div>
	)
}

const meta = {
	title: 'Components/MentionAutocomplete',
	component: MentionAutocomplete,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	render: InteractiveWrapper,
	args: {
		suggestions: mockSuggestions,
		activeIndex: 0,
		onSelect: () => {},
		visible: true,
	},
	argTypes: {
		onSelect: {
			control: false,
		},
	},
} satisfies Meta<typeof MentionAutocomplete>

export default meta
type Story = StoryObj<typeof MentionAutocomplete>

const AutocompleteWrapper = () => {
	const [_activeIndex, _setActiveIndex] = useState(0)
	return (
		<div
			className="relative w-full max-w-md"
			style={{ minHeight: '300px', paddingTop: '60px' }}>
			<Input placeholder="Type @ to mention someone" value="@" readOnly className="mb-2" />
			<MentionAutocomplete
				suggestions={mockSuggestions}
				activeIndex={_activeIndex}
				onSelect={(_suggestion) => {
					// Select handler
				}}
				visible={true}
			/>
		</div>
	)
}

export const Default: Story = {
	render: () => <AutocompleteWrapper />,
}

export const Empty: Story = {
	args: {
		suggestions: [],
		activeIndex: 0,
		onSelect: (_s) => {
			// Select handler
		},
		visible: false,
	},
}
