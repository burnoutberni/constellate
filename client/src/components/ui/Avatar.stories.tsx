import type { Meta, StoryObj } from '@storybook/react'
import { Avatar, AvatarGroup } from './Avatar'

const meta = {
	title: 'Base/Avatar',
	component: Avatar,
	parameters: {
		layout: 'centered',
	},
	tags: ['autodocs'],
	argTypes: {
		size: {
			control: 'select',
			options: ['xs', 'sm', 'md', 'lg', 'xl'],
		},
		rounded: {
			control: 'boolean',
		},
		bordered: {
			control: 'boolean',
		},
		status: {
			control: 'select',
			options: ['online', 'offline', 'away', 'busy'],
		},
	},
} satisfies Meta<typeof Avatar>

export default meta
type Story = StoryObj<typeof Avatar>

export const Default: Story = {
	args: {
		fallback: 'JD',
		alt: 'John Doe',
	},
}

export const WithImage: Story = {
	args: {
		src: 'https://i.pravatar.cc/150?img=12',
		alt: 'User avatar',
		fallback: 'JD',
	},
}

export const WithInitials: Story = {
	args: {
		fallback: 'AB',
		alt: 'Alice Brown',
	},
}

export const ExtraSmall: Story = {
	args: {
		size: 'xs',
		fallback: 'XS',
	},
}

export const Small: Story = {
	args: {
		size: 'sm',
		fallback: 'SM',
	},
}

export const Medium: Story = {
	args: {
		size: 'md',
		fallback: 'MD',
	},
}

export const Large: Story = {
	args: {
		size: 'lg',
		fallback: 'LG',
	},
}

export const ExtraLarge: Story = {
	args: {
		size: 'xl',
		fallback: 'XL',
	},
}

export const WithStatus: Story = {
	args: {
		fallback: 'JD',
		status: 'online',
	},
}

export const Bordered: Story = {
	args: {
		fallback: 'JD',
		bordered: true,
	},
}

export const Square: Story = {
	args: {
		fallback: 'JD',
		rounded: false,
	},
}

export const AllSizes: Story = {
	render: () => (
		<div className="flex items-center gap-4">
			<Avatar size="xs" fallback="XS" />
			<Avatar size="sm" fallback="SM" />
			<Avatar size="md" fallback="MD" />
			<Avatar size="lg" fallback="LG" />
			<Avatar size="xl" fallback="XL" />
		</div>
	),
	parameters: {
		layout: 'padded',
	},
}

export const AllStatuses: Story = {
	render: () => (
		<div className="flex items-center gap-4">
			<Avatar fallback="ON" status="online" />
			<Avatar fallback="OF" status="offline" />
			<Avatar fallback="AW" status="away" />
			<Avatar fallback="BU" status="busy" />
		</div>
	),
	parameters: {
		layout: 'padded',
	},
}

export const Group: Story = {
	render: () => (
		<AvatarGroup
			avatars={[
				{ src: 'https://i.pravatar.cc/150?img=1', fallback: 'A1' },
				{ src: 'https://i.pravatar.cc/150?img=2', fallback: 'A2' },
				{ src: 'https://i.pravatar.cc/150?img=3', fallback: 'A3' },
				{ src: 'https://i.pravatar.cc/150?img=4', fallback: 'A4' },
				{ src: 'https://i.pravatar.cc/150?img=5', fallback: 'A5' },
			]}
		/>
	),
	parameters: {
		layout: 'padded',
	},
}

export const GroupWithMax: Story = {
	render: () => (
		<AvatarGroup
			max={3}
			avatars={[
				{ src: 'https://i.pravatar.cc/150?img=1', fallback: 'A1' },
				{ src: 'https://i.pravatar.cc/150?img=2', fallback: 'A2' },
				{ src: 'https://i.pravatar.cc/150?img=3', fallback: 'A3' },
				{ src: 'https://i.pravatar.cc/150?img=4', fallback: 'A4' },
				{ src: 'https://i.pravatar.cc/150?img=5', fallback: 'A5' },
			]}
		/>
	),
	parameters: {
		layout: 'padded',
	},
}
