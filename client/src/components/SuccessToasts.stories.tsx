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
		addSuccessToast('Operation completed successfully')
		addSuccessToast('Settings saved', { duration: 5000 })
	}, [addSuccessToast])

	return <SuccessToasts />
}

export const Default: Story = {
	render: () => <ToastWrapper />,
}
