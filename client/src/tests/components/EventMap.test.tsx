import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import '@testing-library/jest-dom'

import { EventMap } from '../../components/EventMap'
import { createTestWrapper } from '../testUtils'
import { Event } from '../../types'

// Mock react-leaflet and leaflet
vi.mock('react-leaflet', () => ({
	MapContainer: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="map-container">{children}</div>
	),
	TileLayer: () => <div data-testid="tile-layer" />,
	Marker: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="marker">{children}</div>
	),
	Popup: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="popup">{children}</div>
	),
}))

vi.mock('react-leaflet-cluster', () => ({
	default: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="marker-cluster">{children}</div>
	),
}))

describe('EventMap', () => {
	const mockEvents: Event[] = [
		{
			id: 'event-1',
			title: 'Event One',
			startTime: new Date().toISOString(),
			locationLatitude: 40.7128,
			locationLongitude: -74.006,
			timezone: 'UTC',
			tags: [],
			user: {
				id: 'user1',
				username: 'user1',
				isRemote: false,
			},
		},
		{
			id: 'event-2',
			title: 'Event Two',
			startTime: new Date().toISOString(),
			locationLatitude: 34.0522,
			locationLongitude: -118.2437,
			timezone: 'UTC',
			tags: [],
			user: {
				id: 'user2',
				username: 'user2',
				isRemote: false,
			},
		},
		{
			id: 'event-3',
			title: 'Event Three',
			startTime: new Date().toISOString(),
			locationLatitude: null,
			locationLongitude: null,
			timezone: 'UTC',
			tags: [],
			user: {
				id: 'user3',
				username: 'user3',
				isRemote: false,
			},
		},
	]

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('renders map container when there are events with location', () => {
		const { wrapper } = createTestWrapper()
		render(<EventMap events={mockEvents} />, { wrapper })
		expect(screen.getByTestId('map-container')).toBeInTheDocument()
	})

	it('renders markers for events with location', () => {
		const { wrapper } = createTestWrapper()
		render(<EventMap events={mockEvents} />, { wrapper })
		const markers = screen.getAllByTestId('marker')
		expect(markers).toHaveLength(2) // Only 2 events have location
	})

	it('renders nothing when no events have location', () => {
		const noLocEvents = [mockEvents[2]]
		const { wrapper } = createTestWrapper()
		const { container } = render(<EventMap events={noLocEvents} />, { wrapper })
		expect(container).toBeEmptyDOMElement()
	})

	it('renders nothing when events list is empty', () => {
		const { wrapper } = createTestWrapper()
		const { container } = render(<EventMap events={[]} />, { wrapper })
		expect(container).toBeEmptyDOMElement()
	})
})
