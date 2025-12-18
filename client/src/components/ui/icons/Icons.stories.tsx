import type { Meta, StoryObj } from '@storybook/react'

import {
	AddIcon,
	ArrowRightIcon,
	AttendeesIcon,
	BellIcon,
	CalendarIcon,
	CommentIcon,
	EyeIcon,
	FlagIcon,
	GridViewIcon,
	LikeIcon,
	ListViewIcon,
	LocationIcon,
	SearchIcon,
} from '@/components/ui'

const meta = {
	title: 'Base/Icons',
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const allIcons = [
	{ name: 'AddIcon', component: AddIcon },
	{ name: 'ArrowRightIcon', component: ArrowRightIcon },
	{ name: 'AttendeesIcon', component: AttendeesIcon },
	{ name: 'BellIcon', component: BellIcon },
	{ name: 'CalendarIcon', component: CalendarIcon },
	{ name: 'CommentIcon', component: CommentIcon },
	{ name: 'EyeIcon', component: EyeIcon },
	{ name: 'FlagIcon', component: FlagIcon },
	{ name: 'GridViewIcon', component: GridViewIcon },
	{ name: 'LikeIcon', component: LikeIcon },
	{ name: 'ListViewIcon', component: ListViewIcon },
	{ name: 'LocationIcon', component: LocationIcon },
	{ name: 'SearchIcon', component: SearchIcon },
]

export const AllIcons: Story = {
	render: () => (
		<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
			{allIcons.map(({ name, component: Icon }) => (
				<div
					key={name}
					className="flex flex-col items-center justify-center p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-background-primary">
					<Icon className="w-8 h-8 text-text-primary mb-2" />
					<span className="text-xs text-text-secondary text-center font-mono">
						{name}
					</span>
				</div>
			))}
		</div>
	),
}

export const Sizes: Story = {
	render: () => (
		<div className="space-y-8">
			{allIcons.slice(0, 4).map(({ name, component: Icon }) => (
				<div key={name} className="space-y-4">
					<h3 className="text-sm font-semibold text-text-primary">{name}</h3>
					<div className="flex items-center gap-6">
						<div className="flex flex-col items-center gap-2">
							<Icon className="w-3 h-3 text-text-primary" />
							<span className="text-xs text-text-secondary">w-3 h-3</span>
						</div>
						<div className="flex flex-col items-center gap-2">
							<Icon className="w-4 h-4 text-text-primary" />
							<span className="text-xs text-text-secondary">w-4 h-4</span>
						</div>
						<div className="flex flex-col items-center gap-2">
							<Icon className="w-5 h-5 text-text-primary" />
							<span className="text-xs text-text-secondary">w-5 h-5</span>
						</div>
						<div className="flex flex-col items-center gap-2">
							<Icon className="w-6 h-6 text-text-primary" />
							<span className="text-xs text-text-secondary">w-6 h-6</span>
						</div>
						<div className="flex flex-col items-center gap-2">
							<Icon className="w-8 h-8 text-text-primary" />
							<span className="text-xs text-text-secondary">w-8 h-8</span>
						</div>
						<div className="flex flex-col items-center gap-2">
							<Icon className="w-12 h-12 text-text-primary" />
							<span className="text-xs text-text-secondary">w-12 h-12</span>
						</div>
					</div>
				</div>
			))}
		</div>
	),
}

export const Colors: Story = {
	render: () => (
		<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
			{allIcons.slice(0, 8).map(({ name, component: Icon }) => (
				<div
					key={name}
					className="flex flex-col items-center gap-3 p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg">
					<div className="flex items-center gap-4">
						<Icon className="w-6 h-6 text-text-primary" />
						<Icon className="w-6 h-6 text-primary-600" />
						<Icon className="w-6 h-6 text-success-600" />
						<Icon className="w-6 h-6 text-error-600" />
					</div>
					<span className="text-xs text-text-secondary text-center font-mono">
						{name}
					</span>
				</div>
			))}
		</div>
	),
}

export const InButtons: Story = {
	render: () => (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-4">
				<button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
					<AddIcon className="w-4 h-4" />
					Add Item
				</button>
				<button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
					<SearchIcon className="w-4 h-4" />
					Search
				</button>
				<button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
					<CalendarIcon className="w-4 h-4" />
					Calendar
				</button>
				<button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
					<LocationIcon className="w-4 h-4" />
					Location
				</button>
			</div>
			<div className="flex flex-wrap gap-4">
				<button className="flex items-center gap-2 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800">
					<LikeIcon className="w-4 h-4" />
					Like
				</button>
				<button className="flex items-center gap-2 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800">
					<CommentIcon className="w-4 h-4" />
					Comment
				</button>
				<button className="flex items-center gap-2 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800">
					<AttendeesIcon className="w-4 h-4" />
					Attendees
				</button>
				<button className="flex items-center gap-2 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800">
					<BellIcon className="w-4 h-4" />
					Notifications
				</button>
			</div>
		</div>
	),
}

export const IconList: Story = {
	render: () => (
		<div className="space-y-2">
			{allIcons.map(({ name, component: Icon }) => (
				<div
					key={name}
					className="flex items-center gap-4 p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
					<Icon className="w-5 h-5 text-text-primary flex-shrink-0" />
					<div className="flex-1">
						<div className="font-mono text-sm text-text-primary">{name}</div>
						<div className="text-xs text-text-secondary">
							Import:{' '}
							<code className="bg-neutral-100 dark:bg-neutral-800 px-1 rounded">
								import {'{'}
								{name}
								{'}'} from &apos;@/components/ui&apos;
							</code>
						</div>
					</div>
				</div>
			))}
		</div>
	),
}
