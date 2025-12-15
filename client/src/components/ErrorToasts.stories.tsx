import type { Meta, StoryObj } from '@storybook/react'
import { useEffect } from 'react'

import { useUIStore } from '@/stores'

import { ErrorToasts } from './ErrorToasts'

const meta = {
	title: 'Components/ErrorToasts',
	component: ErrorToasts,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof ErrorToasts>

export default meta
type Story = StoryObj<typeof ErrorToasts>

const ToastWrapper = () => {
	const addErrorToast = useUIStore((state) => state.addErrorToast)

	useEffect(() => {
		addErrorToast({ id: crypto.randomUUID(), message: 'An error occurred' })
		addErrorToast({ id: crypto.randomUUID(), message: 'Another error occurred' })
	}, [addErrorToast])

	return <ErrorToasts />
}

export const Default: Story = {
	render: () => <ToastWrapper />,
}
