import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'
import { UserMenu } from './UserMenu'

const meta = {
	title: 'Components/UserMenu',
	component: UserMenu,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	render: (args) => (
		<div
			style={{
				position: 'relative',
				minHeight: '400px',
				padding: '2rem',
				display: 'flex',
				justifyContent: 'flex-end',
			}}>
			<UserMenu {...args} />
		</div>
	),
	decorators: [
		(Story) => (
			<MemoryRouter>
				<Story />
			</MemoryRouter>
		),
	],
} satisfies Meta<typeof UserMenu>

export default meta
type Story = StoryObj<typeof UserMenu>

const mockUser = {
	id: 'user1',
	name: 'John Doe',
	email: 'john@example.com',
	username: 'johndoe',
	image: 'https://i.pravatar.cc/150?img=12',
}

export const Default: Story = {
	args: {
		user: mockUser,
		onLogout: () => console.log('Logout'),
	},
}

export const WithoutImage: Story = {
	args: {
		user: {
			...mockUser,
			image: null,
		},
		onLogout: () => console.log('Logout'),
	},
}

export const Admin: Story = {
	args: {
		user: mockUser,
		isAdmin: true,
		onLogout: () => console.log('Logout'),
	},
}

export const MinimalUser: Story = {
	args: {
		user: {
			id: 'user1',
			username: 'johndoe',
		},
		onLogout: () => console.log('Logout'),
	},
}
