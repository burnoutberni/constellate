import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReminderSelector } from '../../components/ReminderSelector'

describe('ReminderSelector', () => {
	const defaultProps = {
		value: null,
		onChange: vi.fn(),
		isAuthenticated: true,
		canManageReminder: true,
		isPending: false,
		eventHasStarted: false,
	}

	it('renders null when event has started', () => {
		const { container } = render(<ReminderSelector {...defaultProps} eventHasStarted={true} />)
		expect(container.firstChild).toBeNull()
	})

	it('renders reminder selector with label', () => {
		render(<ReminderSelector {...defaultProps} />)

		expect(screen.getByText('Reminder')).toBeInTheDocument()
		expect(screen.getByLabelText('Reminder notification timing')).toBeInTheDocument()
	})

	it('renders default reminder options', () => {
		render(<ReminderSelector {...defaultProps} />)

		const select = screen.getByLabelText('Reminder notification timing')
		expect(select).toBeInTheDocument()

		const options = screen.getAllByRole('option')
		expect(options.length).toBeGreaterThan(0)
		expect(screen.getByText('No reminder')).toBeInTheDocument()
		expect(screen.getByText('5 minutes before')).toBeInTheDocument()
		expect(screen.getByText('1 hour before')).toBeInTheDocument()
	})

	it('displays current value', () => {
		render(<ReminderSelector {...defaultProps} value={60} />)

		const select = screen.getByLabelText('Reminder notification timing')
		// Check that the selected option is visible to the user
		expect(select).toHaveValue('60')
	})

	it('calls onChange with correct value', () => {
		const onChange = vi.fn()
		render(<ReminderSelector {...defaultProps} onChange={onChange} />)

		const select = screen.getByLabelText('Reminder notification timing')
		fireEvent.change(select, { target: { value: '60' } })

		expect(onChange).toHaveBeenCalledWith(60)
	})

	it('calls onChange with null when empty value is selected', () => {
		const onChange = vi.fn()
		render(<ReminderSelector {...defaultProps} onChange={onChange} value={60} />)

		const select = screen.getByLabelText('Reminder notification timing')
		fireEvent.change(select, { target: { value: '' } })

		expect(onChange).toHaveBeenCalledWith(null)
	})

	it('disables selector when user is not authenticated', () => {
		render(<ReminderSelector {...defaultProps} isAuthenticated={false} />)

		const select = screen.getByLabelText('Reminder notification timing')
		expect(select).toBeDisabled()
	})

	it('disables selector when user cannot manage reminder', () => {
		render(<ReminderSelector {...defaultProps} canManageReminder={false} />)

		const select = screen.getByLabelText('Reminder notification timing')
		expect(select).toBeDisabled()
	})

	it('disables selector when pending', () => {
		render(<ReminderSelector {...defaultProps} isPending={true} />)

		const select = screen.getByLabelText('Reminder notification timing')
		expect(select).toBeDisabled()
	})

	it('shows saving text when pending', () => {
		render(<ReminderSelector {...defaultProps} isPending={true} />)

		expect(screen.getByText('Saving...')).toBeInTheDocument()
	})

	it('shows correct helper text for unauthenticated users', () => {
		render(<ReminderSelector {...defaultProps} isAuthenticated={false} />)

		expect(screen.getByText('Sign up to save reminder notifications.')).toBeInTheDocument()
	})

	it('shows correct helper text when user can manage reminder', () => {
		render(<ReminderSelector {...defaultProps} canManageReminder={true} />)

		expect(
			screen.getByText('We will send reminder notifications and email (if configured).')
		).toBeInTheDocument()
	})

	it('shows correct helper text when user cannot manage reminder', () => {
		render(<ReminderSelector {...defaultProps} canManageReminder={false} />)

		expect(screen.getByText('RSVP as Going or Maybe to enable reminders.')).toBeInTheDocument()
	})

	it('renders custom reminder options', () => {
		const customOptions = [
			{ label: 'Custom 1', value: 10 },
			{ label: 'Custom 2', value: 20 },
		]

		render(<ReminderSelector {...defaultProps} options={customOptions} />)

		expect(screen.getByText('Custom 1')).toBeInTheDocument()
		expect(screen.getByText('Custom 2')).toBeInTheDocument()
		expect(screen.queryByText('No reminder')).not.toBeInTheDocument()
	})
})
