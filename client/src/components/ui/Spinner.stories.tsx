import type { Meta, StoryObj } from '@storybook/react'

import { Spinner } from './Spinner'

const meta = {
    title: 'Base/Spinner',
    component: Spinner,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    argTypes: {
        size: {
            control: 'select',
            options: ['sm', 'md', 'lg'],
        },
        variant: {
            control: 'select',
            options: ['primary', 'secondary', 'white'],
        },
    },
} satisfies Meta<typeof Spinner>

export default meta
type Story = StoryObj<typeof Spinner>

export const Default: Story = {
    args: {},
}

export const Small: Story = {
    args: {
        size: 'sm',
    },
}

export const Medium: Story = {
    args: {
        size: 'md',
    },
}

export const Large: Story = {
    args: {
        size: 'lg',
    },
}

export const Primary: Story = {
    args: {
        variant: 'primary',
    },
}

export const Secondary: Story = {
    args: {
        variant: 'secondary',
    },
}

export const White: Story = {
    args: {
        variant: 'white',
    },
    parameters: {
        backgrounds: {
            default: 'dark',
        },
    },
}

export const AllSizes: Story = {
    render: () => (
        <div className="flex items-center gap-4">
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
        </div>
    ),
    parameters: {
        layout: 'padded',
    },
}

export const AllVariants: Story = {
    render: () => (
        <div className="flex items-center gap-4">
            <Spinner variant="primary" />
            <Spinner variant="secondary" />
        </div>
    ),
    parameters: {
        layout: 'padded',
    },
}

export const InButton: Story = {
    render: () => (
        <div className="flex gap-2">
            <button className="px-4 py-2 bg-primary-600 text-white dark:bg-primary-500 dark:text-white rounded-lg flex items-center gap-2">
                <Spinner size="sm" variant="white" />
                Loading...
            </button>
        </div>
    ),
    parameters: {
        layout: 'padded',
    },
}
