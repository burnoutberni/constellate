import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Breadcrumbs } from '../../components/Breadcrumbs'

describe('Breadcrumbs Component', () => {
	it('should render breadcrumbs from route path', () => {
		render(
			<MemoryRouter initialEntries={['/feed']}>
				<Breadcrumbs />
			</MemoryRouter>
		)

		expect(screen.getByText('Home')).toBeInTheDocument()
		expect(screen.getByText('Feed')).toBeInTheDocument()
	})

	it('should show current page as non-clickable', () => {
		render(
			<MemoryRouter initialEntries={['/settings']}>
				<Breadcrumbs />
			</MemoryRouter>
		)

		const settingsLink = screen.getByText('Settings')
		expect(settingsLink).toBeInTheDocument()
		expect(settingsLink).toHaveAttribute('aria-current', 'page')
	})

	it('should generate breadcrumbs for profile routes', () => {
		render(
			<MemoryRouter initialEntries={['/@username']}>
				<Breadcrumbs />
			</MemoryRouter>
		)

		expect(screen.getByText('Home')).toBeInTheDocument()
		expect(screen.getByText('@username')).toBeInTheDocument()
	})

	it('should generate breadcrumbs for event routes', () => {
		render(
			<MemoryRouter initialEntries={['/@username/event123']}>
				<Breadcrumbs />
			</MemoryRouter>
		)

		expect(screen.getByText('Home')).toBeInTheDocument()
		expect(screen.getByText('@username')).toBeInTheDocument()
<<<<<<< HEAD
		expect(screen.getByText('Event123')).toBeInTheDocument()
=======
		expect(screen.getByText('Event')).toBeInTheDocument()
>>>>>>> b821aaf (WP-120: Navigation Redesign)
	})

	it('should use custom breadcrumb items when provided', () => {
		render(
			<MemoryRouter>
				<Breadcrumbs
					items={[
						{ label: 'Home', href: '/' },
						{ label: 'Category', href: '/category' },
						{ label: 'Current Page' },
					]}
				/>
			</MemoryRouter>
		)

		expect(screen.getByText('Home')).toBeInTheDocument()
		expect(screen.getByText('Category')).toBeInTheDocument()
		expect(screen.getByText('Current Page')).toBeInTheDocument()
	})

	it('should render separators between breadcrumb items', () => {
		render(
			<MemoryRouter initialEntries={['/calendar']}>
				<Breadcrumbs />
			</MemoryRouter>
		)

		// Separators are rendered as "/" characters
		const separators = screen.getAllByText('/')
		expect(separators.length).toBeGreaterThan(0)
	})

	it('should have proper ARIA labels', () => {
		render(
			<MemoryRouter initialEntries={['/feed']}>
				<Breadcrumbs />
			</MemoryRouter>
		)

		const nav = screen.getByLabelText('Breadcrumb navigation')
		expect(nav).toBeInTheDocument()
	})

	it('should return null for root path', () => {
		render(
			<MemoryRouter initialEntries={['/']}>
				<Breadcrumbs />
			</MemoryRouter>
		)

		// Should only show Home
		expect(screen.getByText('Home')).toBeInTheDocument()
	})

	it('should handle instances route with domain', () => {
		render(
			<MemoryRouter initialEntries={['/instances/example.com']}>
				<Breadcrumbs />
			</MemoryRouter>
		)

		expect(screen.getByText('Home')).toBeInTheDocument()
		expect(screen.getByText('Instances')).toBeInTheDocument()
<<<<<<< HEAD
		expect(screen.getByText('Example.com')).toBeInTheDocument()
	})

	it('should correctly handle nested routes with configured segments after unconfigured ones', () => {
		render(
			<MemoryRouter initialEntries={['/events/some-event/edit']}>
				<Breadcrumbs />
			</MemoryRouter>
		)

		expect(screen.getByText('Home')).toBeInTheDocument()
		expect(screen.getByText('Events')).toBeInTheDocument()
		expect(screen.getByText('Some Event')).toBeInTheDocument()
		expect(screen.getByText('Edit Event')).toBeInTheDocument()
	})
})
=======
		expect(screen.getByText('example.com')).toBeInTheDocument()
	})
})

>>>>>>> b821aaf (WP-120: Navigation Redesign)
