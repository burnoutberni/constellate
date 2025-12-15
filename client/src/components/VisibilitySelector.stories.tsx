import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'

import type { EventVisibility } from '@/types'

import { VisibilitySelector } from './VisibilitySelector'

const meta = {
	title: 'Components/VisibilitySelector',
	component: VisibilitySelector,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	args: {
		value: 'PUBLIC',
		onChange: () => {},
	},
	argTypes: {
		onChange: {
			control: false,
		},
	},
} satisfies Meta<typeof VisibilitySelector>

export default meta
type Story = StoryObj<typeof VisibilitySelector>

const SelectorWrapper = () => {
	const [value, setValue] = useState<EventVisibility>('PUBLIC')
	return <VisibilitySelector value={value} onChange={setValue} />
}

export const Default: Story = {
	render: () => <SelectorWrapper />,
}

const PublicWrapper = () => {
	const [value, setValue] = useState<EventVisibility>('PUBLIC')
	return <VisibilitySelector value={value} onChange={setValue} />
}

export const Public: Story = {
	render: () => <PublicWrapper />,
}

const FollowersWrapper = () => {
	const [value, setValue] = useState<EventVisibility>('FOLLOWERS')
	return <VisibilitySelector value={value} onChange={setValue} />
}

export const Followers: Story = {
	render: () => <FollowersWrapper />,
}

const UnlistedWrapper = () => {
	const [value, setValue] = useState<EventVisibility>('UNLISTED')
	return <VisibilitySelector value={value} onChange={setValue} />
}

export const Unlisted: Story = {
	render: () => <UnlistedWrapper />,
}

const PrivateWrapper = () => {
	const [value, setValue] = useState<EventVisibility>('PRIVATE')
	return <VisibilitySelector value={value} onChange={setValue} />
}

export const Private: Story = {
	render: () => <PrivateWrapper />,
}
