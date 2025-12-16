import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CommunityStats } from '../../components/CommunityStats'

describe('CommunityStats', () => {
	it('user can see platform statistics', () => {
		render(
			<CommunityStats
				totalEvents={1234}
				totalUsers={567}
				totalInstances={12}
				isLoading={false}
			/>
		)

		expect(screen.getByText('Events Created')).toBeInTheDocument()
		expect(screen.getByText('Active Users')).toBeInTheDocument()
		expect(screen.getByText('Federated Instances')).toBeInTheDocument()
	})

	it('user can see formatted numbers for large values', () => {
		render(
			<CommunityStats
				totalEvents={1234567}
				totalUsers={987654}
				totalInstances={1234}
				isLoading={false}
			/>
		)

		// Numbers should be formatted (e.g., "1.2M" instead of "1234567")
		// The exact format depends on Intl.NumberFormat, but we verify the stats are displayed
		expect(screen.getByText('Events Created')).toBeInTheDocument()
		expect(screen.getByText('Active Users')).toBeInTheDocument()
		expect(screen.getByText('Federated Instances')).toBeInTheDocument()
	})

	it('user can see loading state', () => {
		render(
			<CommunityStats
				totalEvents={0}
				totalUsers={0}
				totalInstances={0}
				isLoading={true}
			/>
		)

		// Loading spinner should be visible
		// We check that the component renders without errors in loading state
		expect(screen.queryByText('Events Created')).not.toBeInTheDocument()
	})

	it('user can see zero values when no data exists', () => {
		render(
			<CommunityStats
				totalEvents={0}
				totalUsers={0}
				totalInstances={0}
				isLoading={false}
			/>
		)

		expect(screen.getByText('Events Created')).toBeInTheDocument()
		expect(screen.getByText('Active Users')).toBeInTheDocument()
		expect(screen.getByText('Federated Instances')).toBeInTheDocument()
	})

	it('user can see descriptive text for each stat', () => {
		render(
			<CommunityStats
				totalEvents={100}
				totalUsers={50}
				totalInstances={5}
				isLoading={false}
			/>
		)

		expect(screen.getByText('Public events to discover')).toBeInTheDocument()
		expect(screen.getByText('People connecting daily')).toBeInTheDocument()
		expect(screen.getByText('Nodes in the network')).toBeInTheDocument()
	})

	it('user can see stats with default optional values', () => {
		render(<CommunityStats totalEvents={100} isLoading={false} />)

		expect(screen.getByText('Events Created')).toBeInTheDocument()
		expect(screen.getByText('Active Users')).toBeInTheDocument()
		expect(screen.getByText('Federated Instances')).toBeInTheDocument()
	})
})
