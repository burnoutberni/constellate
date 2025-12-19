import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'

import { ThemeProvider } from '@/design-system'

import { TermsOfServiceAgreement } from './TermsOfServiceAgreement'

function InteractiveWrapper() {
	const [checked, setChecked] = useState(false)

	return (
		<div className="p-4">
			<TermsOfServiceAgreement checked={checked} onChange={setChecked} />
			<div className="mt-4 text-sm text-text-secondary">
				Checked: {checked ? 'Yes' : 'No'}
			</div>
		</div>
	)
}

const meta = {
	title: 'Components/TermsOfServiceAgreement',
	component: TermsOfServiceAgreement,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<ThemeProvider defaultTheme="light">
				<Story />
			</ThemeProvider>
		),
	],
} satisfies Meta<typeof TermsOfServiceAgreement>

export default meta
type Story = StoryObj<typeof TermsOfServiceAgreement>

export const Default: Story = {
	render: () => <InteractiveWrapper />,
}

function CheckedWrapper() {
	const [checked, setChecked] = useState(true)
	return (
		<div className="p-4">
			<TermsOfServiceAgreement checked={checked} onChange={setChecked} />
		</div>
	)
}

function UncheckedWrapper() {
	const [checked, setChecked] = useState(false)
	return (
		<div className="p-4">
			<TermsOfServiceAgreement checked={checked} onChange={setChecked} />
		</div>
	)
}

export const Checked: Story = {
	render: () => <CheckedWrapper />,
}

export const Unchecked: Story = {
	render: () => <UncheckedWrapper />,
}
