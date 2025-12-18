import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { HomeHero } from '../../components/HomeHero'

describe('HomeHero', () => {
	it('should render hero title and description for unauthenticated users', () => {
		render(
			<BrowserRouter>
				<HomeHero isAuthenticated={false} />
			</BrowserRouter>
		)

		expect(screen.getByText(/Connect Across the/i)).toBeInTheDocument()
		expect(screen.getByText(/Fediverse/i)).toBeInTheDocument()
		expect(
			screen.getByText(/Create, discover, and join events without borders/i)
		).toBeInTheDocument()
		expect(screen.getByText('Get Started')).toBeInTheDocument()
		expect(screen.getByText('Browse Events')).toBeInTheDocument()
	})

	it('should render different CTAs for authenticated users', () => {
		render(
			<BrowserRouter>
				<HomeHero isAuthenticated={true} />
			</BrowserRouter>
		)

		expect(screen.getByText(/Connect Across the/i)).toBeInTheDocument()
		expect(screen.getByText('Go to Feed')).toBeInTheDocument()
		expect(screen.getByText('Explore')).toBeInTheDocument()
		expect(screen.queryByText('Get Started')).not.toBeInTheDocument()
		expect(screen.queryByText('Browse Events')).not.toBeInTheDocument()
	})

	it('should show social proof for unauthenticated users', () => {
		render(
			<BrowserRouter>
				<HomeHero isAuthenticated={false} />
			</BrowserRouter>
		)

		expect(screen.getByText(/Federated \(ActivityPub\)/i)).toBeInTheDocument()
		expect(screen.getByText(/Open Source/i)).toBeInTheDocument()
		expect(screen.getByText(/Self-Hostable/i)).toBeInTheDocument()
	})

	it('should still show social proof for authenticated users', () => {
		render(
			<BrowserRouter>
				<HomeHero isAuthenticated={true} />
			</BrowserRouter>
		)

		expect(screen.getByText(/Federated \(ActivityPub\)/i)).toBeInTheDocument()
	})
})
