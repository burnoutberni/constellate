import type { Meta, StoryObj } from '@storybook/react'
import { useEffect } from 'react'

import { useUIStore } from '@/stores'

import { SuccessToasts } from './SuccessToasts'

const meta = {
	title: 'Components/SuccessToasts',
	component: SuccessToasts,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof SuccessToasts>

export default meta
type Story = StoryObj<typeof SuccessToasts>

const ToastWrapper = () => {
	const addSuccessToast = useUIStore((state) => state.addSuccessToast)

	useEffect(() => {
		addSuccessToast({ id: crypto.randomUUID(), message: 'Operation completed successfully' })
		addSuccessToast({ id: crypto.randomUUID(), message: 'Settings saved' })
	}, [addSuccessToast])

	return <SuccessToasts />
}

export const Default: Story = {
	render: () => <ToastWrapper />,
}
