import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Tooltip } from '../../components/ui/Tooltip'

describe('Tooltip Component', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should render children', () => {
		render(
			<Tooltip content="Tooltip text">
				<button>Hover me</button>
			</Tooltip>
		)

		expect(screen.getByRole('button', { name: /Hover me/i })).toBeInTheDocument()
	})

	it('should not show tooltip by default', () => {
		render(
			<Tooltip content="Tooltip text">
				<button>Hover me</button>
			</Tooltip>
		)

		expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
	})

	it('should show tooltip on mouse enter', () => {
		render(
			<Tooltip content="Tooltip text">
				<button>Hover me</button>
			</Tooltip>
		)

		const tooltipTrigger = screen.getByRole('button', { name: /Hover me/i })
		fireEvent.mouseEnter(tooltipTrigger)

		expect(screen.getByRole('tooltip')).toBeInTheDocument()
		expect(screen.getByText('Tooltip text')).toBeInTheDocument()
	})

	it('should hide tooltip on mouse leave', () => {
		render(
			<Tooltip content="Tooltip text">
				<button>Hover me</button>
			</Tooltip>
		)

		const tooltipTrigger = screen.getByRole('button', { name: /Hover me/i })
		fireEvent.mouseEnter(tooltipTrigger)

		expect(screen.getByRole('tooltip')).toBeInTheDocument()

		fireEvent.mouseLeave(tooltipTrigger)

		expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
	})

	it('should show tooltip on focus', () => {
		render(
			<Tooltip content="Tooltip text">
				<button>Hover me</button>
			</Tooltip>
		)

		const tooltipTrigger = screen.getByRole('button', { name: /Hover me/i })

		act(() => {
			tooltipTrigger.focus()
		})

		expect(screen.getByRole('tooltip')).toBeInTheDocument()
	})

	it('should hide tooltip on blur', () => {
		render(
			<Tooltip content="Tooltip text">
				<button>Hover me</button>
			</Tooltip>
		)

		const tooltipTrigger = screen.getByRole('button', { name: /Hover me/i })

		act(() => {
			tooltipTrigger.focus()
		})

		expect(screen.getByRole('tooltip')).toBeInTheDocument()

		act(() => {
			tooltipTrigger.blur()
		})

		expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
	})

	it('should render with default top position', () => {
		render(
			<Tooltip content="Tooltip text">
				<button>Hover me</button>
			</Tooltip>
		)

		const tooltipTrigger = screen.getByRole('button', { name: /Hover me/i })
		fireEvent.mouseEnter(tooltipTrigger)

		const tooltip = screen.getByRole('tooltip')
		expect(tooltip).toHaveClass('bottom-full')
		expect(tooltip).toHaveClass('-translate-x-1/2')
	})

	it('should render with bottom position when specified', () => {
		render(
			<Tooltip content="Tooltip text" side="bottom">
				<button>Hover me</button>
			</Tooltip>
		)

		const tooltipTrigger = screen.getByRole('button', { name: /Hover me/i })
		fireEvent.mouseEnter(tooltipTrigger)

		const tooltip = screen.getByRole('tooltip')
		expect(tooltip).toHaveClass('top-full')
		expect(tooltip).toHaveClass('-translate-x-1/2')
	})

	it('should render with left position when specified', () => {
		render(
			<Tooltip content="Tooltip text" side="left">
				<button>Hover me</button>
			</Tooltip>
		)

		const tooltipTrigger = screen.getByRole('button', { name: /Hover me/i })
		fireEvent.mouseEnter(tooltipTrigger)

		const tooltip = screen.getByRole('tooltip')
		expect(tooltip).toHaveClass('right-full')
		expect(tooltip).toHaveClass('-translate-y-1/2')
	})

	it('should render with right position when specified', () => {
		render(
			<Tooltip content="Tooltip text" side="right">
				<button>Hover me</button>
			</Tooltip>
		)

		const tooltipTrigger = screen.getByRole('button', { name: /Hover me/i })
		fireEvent.mouseEnter(tooltipTrigger)

		const tooltip = screen.getByRole('tooltip')
		expect(tooltip).toHaveClass('left-full')
		expect(tooltip).toHaveClass('-translate-y-1/2')
	})

	it('should apply custom className', () => {
		render(
			<Tooltip content="Tooltip text" className="custom-tooltip">
				<button>Hover me</button>
			</Tooltip>
		)

		const tooltipWrapper = screen.getByRole('button').parentElement
		expect(tooltipWrapper).toHaveClass('custom-tooltip')
	})

	it('should render tooltip with different content types', () => {
		render(
			<Tooltip content={<span>React element</span>}>
				<button>Hover me</button>
			</Tooltip>
		)

		const tooltipTrigger = screen.getByRole('button', { name: /Hover me/i })
		fireEvent.mouseEnter(tooltipTrigger)

		expect(screen.getByText('React element')).toBeInTheDocument()
	})

	it('should have proper ARIA attributes', () => {
		render(
			<Tooltip content="Tooltip text">
				<button>Hover me</button>
			</Tooltip>
		)

		const tooltipTrigger = screen.getByRole('button', { name: /Hover me/i })
		fireEvent.mouseEnter(tooltipTrigger)

		const tooltip = screen.getByRole('tooltip')
		expect(tooltip).toHaveAttribute('role', 'tooltip')
	})

	it('should have arrow indicator', () => {
		render(
			<Tooltip content="Tooltip text">
				<button>Hover me</button>
			</Tooltip>
		)

		const tooltipTrigger = screen.getByRole('button', { name: /Hover me/i })
		fireEvent.mouseEnter(tooltipTrigger)

		const tooltip = screen.getByRole('tooltip')
		const arrow = tooltip.querySelector('.border-4')
		expect(arrow).toBeInTheDocument()
	})

	it('should handle rapid mouse enter/leave gracefully', () => {
		render(
			<Tooltip content="Tooltip text">
				<button>Hover me</button>
			</Tooltip>
		)

		const tooltipTrigger = screen.getByRole('button', { name: /Hover me/i })

		fireEvent.mouseEnter(tooltipTrigger)
		fireEvent.mouseLeave(tooltipTrigger)
		fireEvent.mouseEnter(tooltipTrigger)
		fireEvent.mouseLeave(tooltipTrigger)

		expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
	})

	it('should be accessible via keyboard', () => {
		render(
			<Tooltip content="Tooltip text">
				<button>Hover me</button>
			</Tooltip>
		)

		const tooltipTrigger = screen.getByRole('button', { name: /Hover me/i })

		act(() => {
			tooltipTrigger.focus()
		})

		expect(screen.getByRole('tooltip')).toBeInTheDocument()
	})
})
