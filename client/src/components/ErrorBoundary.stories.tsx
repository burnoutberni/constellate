import type { Meta, StoryObj } from '@storybook/react'
import React, { useState } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { Button } from './ui'

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
	if (shouldThrow) {
		throw new Error('This is a test error to demonstrate the ErrorBoundary')
	}
	return (
		<div className="p-4 bg-success-50 border border-success-200 rounded">
			✅ Content rendered successfully
		</div>
	)
}

// Interactive wrapper for Docs page
const InteractiveWrapper = () => {
	const [shouldThrow, setShouldThrow] = useState(true)
	const [key, setKey] = useState(0)

	const handleShowError = () => {
		setShouldThrow(true)
		setKey((k) => k + 1) // Force remount to show error
	}

	const handleShowNormal = () => {
		setShouldThrow(false)
		setKey((k) => k + 1) // Force remount to show normal
	}

	return (
		<div className="space-y-4">
			<div className="flex gap-2">
				<Button onClick={handleShowError} variant={shouldThrow ? 'primary' : 'secondary'}>
					Show Error State
				</Button>
				<Button onClick={handleShowNormal} variant={!shouldThrow ? 'primary' : 'secondary'}>
					Show Normal State
				</Button>
			</div>
			<ErrorBoundary
				key={key}
				resetKeys={[shouldThrow ? 'error' : 'normal']}
				onError={(error, errorInfo) => {
					console.log('Error caught:', error, errorInfo)
				}}>
				<ThrowError shouldThrow={shouldThrow} />
			</ErrorBoundary>
		</div>
	)
}

const meta = {
	title: 'Components/ErrorBoundary',
	component: ErrorBoundary,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	render: InteractiveWrapper,
} satisfies Meta<typeof ErrorBoundary>

export default meta
type Story = StoryObj<typeof ErrorBoundary>

const ThrowErrorSimple = () => {
	throw new Error('This is a test error')
}

export const Default: Story = {
	args: {
		children: (
			<div>
				<h2>Normal Content</h2>
				<p>This content is displayed normally.</p>
			</div>
		),
	},
}

export const WithError: Story = {
	args: {
		children: <ThrowErrorSimple />,
		onError: (error, errorInfo) => {
			console.log('Error caught:', error, errorInfo)
		},
	},
}

export const CustomFallback: Story = {
	args: {
		children: <ThrowErrorSimple />,
		fallback: (
			<div className="p-4 border border-red-500 rounded">
				<h3>Custom Error Display</h3>
				<p>Something went wrong, but we have a custom fallback!</p>
			</div>
		),
	},
}
