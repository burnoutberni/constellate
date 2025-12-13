import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CalendarExport } from '../../components/CalendarExport'

describe('CalendarExport', () => {
	const mockEvent = {
		title: 'Test Event',
		description: 'This is a test event',
		location: 'Test Location',
		startTime: '2024-12-15T10:00:00Z',
		endTime: '2024-12-15T12:00:00Z',
		timezone: 'UTC',
		url: 'https://example.com/event/1',
	}

	// Mock window.open - return null to prevent jsdom navigation warnings
	let originalOpen: typeof window.open
	let originalBlob: typeof Blob
	let blobConstructorSpy: ReturnType<typeof vi.fn>

	beforeEach(() => {
		originalOpen = window.open
		// Return null to prevent jsdom "Not implemented: navigation to another Document" warnings
		window.open = vi.fn(() => null)

		// Mock Blob constructor - needs to be a proper constructor class that we can spy on
		originalBlob = global.Blob
		blobConstructorSpy = vi.fn()

		class MockBlob {
			parts: unknown[]
			options: { type?: string }
			type: string
			constructor(parts: unknown[], options?: { type?: string }) {
				blobConstructorSpy(parts, options)
				this.parts = parts
				this.options = options || {}
				this.type = options?.type || ''
			}
		}

		global.Blob = MockBlob as unknown as typeof Blob
	})

	afterEach(() => {
		window.open = originalOpen
		global.Blob = originalBlob
	})

	// Mock URL.createObjectURL and URL.revokeObjectURL
	beforeEach(() => {
		global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
		global.URL.revokeObjectURL = vi.fn()
	})

	it('renders calendar export buttons', () => {
		render(<CalendarExport {...mockEvent} />)

		expect(screen.getByText('Add to Calendar')).toBeInTheDocument()
		expect(screen.getByText('Download iCal')).toBeInTheDocument()
		expect(screen.getByText('Google Calendar')).toBeInTheDocument()
	})

	it('generates iCal download on button click', () => {
		const createElementSpy = vi.spyOn(document, 'createElement')
		const appendChildSpy = vi.spyOn(document.body, 'appendChild')
		const removeChildSpy = vi.spyOn(document.body, 'removeChild')

		render(<CalendarExport {...mockEvent} />)

		const icalButton = screen.getByText('Download iCal')
		fireEvent.click(icalButton)

		// Verify link element was created (filter for 'a' tag calls only)
		const anchorCalls = createElementSpy.mock.calls.filter((call) => call[0] === 'a')
		expect(anchorCalls.length).toBeGreaterThan(0)

		// Verify blob was created
		expect(global.URL.createObjectURL).toHaveBeenCalled()

		// Verify link was appended and removed
		expect(appendChildSpy).toHaveBeenCalled()
		expect(removeChildSpy).toHaveBeenCalled()

		// Verify URL was revoked
		expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')

		createElementSpy.mockRestore()
		appendChildSpy.mockRestore()
		removeChildSpy.mockRestore()
	})

	it('opens Google Calendar in new window', () => {
		render(<CalendarExport {...mockEvent} />)

		const googleButton = screen.getByText('Google Calendar')
		fireEvent.click(googleButton)

		expect(window.open).toHaveBeenCalled()
		const call = (window.open as ReturnType<typeof vi.fn>).mock.calls[0]
		const url = call[0] as string

		expect(url).toContain('calendar.google.com')
		expect(url).toContain('Test+Event')
	})

	it('includes event details in iCal content', () => {
		render(<CalendarExport {...mockEvent} />)

		const icalButton = screen.getByText('Download iCal')
		fireEvent.click(icalButton)

		expect(blobConstructorSpy).toHaveBeenCalled()
		// Get the blob content from the first call's first argument (parts array)
		const blobCall = blobConstructorSpy.mock.calls[0]
		const blobContent = (blobCall[0] as unknown[])[0] as string

		expect(blobContent).toContain('BEGIN:VCALENDAR')
		expect(blobContent).toContain('SUMMARY:Test Event')
		expect(blobContent).toContain('DESCRIPTION:This is a test event')
		expect(blobContent).toContain('LOCATION:Test Location')
		expect(blobContent).toContain('END:VCALENDAR')
	})

	it('handles event without optional fields', () => {
		const minimalEvent = {
			title: 'Minimal Event',
			startTime: '2024-12-15T10:00:00Z',
		}

		render(<CalendarExport {...minimalEvent} />)

		const icalButton = screen.getByText('Download iCal')
		fireEvent.click(icalButton)

		const blobCall = blobConstructorSpy.mock.calls[0]
		const blobContent = (blobCall[0] as unknown[])[0] as string

		expect(blobContent).toContain('SUMMARY:Minimal Event')
		expect(blobContent).not.toContain('DESCRIPTION:')
		expect(blobContent).not.toContain('LOCATION:')
	})

	it('escapes special characters in iCal content', () => {
		const eventWithSpecialChars = {
			...mockEvent,
			title: 'Event, with; special\\chars',
			description: 'Line 1\nLine 2',
		}

		render(<CalendarExport {...eventWithSpecialChars} />)

		const icalButton = screen.getByText('Download iCal')
		fireEvent.click(icalButton)

		const blobCall = blobConstructorSpy.mock.calls[0]
		const blobContent = (blobCall[0] as unknown[])[0] as string

		expect(blobContent).toContain('SUMMARY:Event\\, with\\; special\\\\chars')
		expect(blobContent).toContain('Line 1\\nLine 2')
	})

	it('generates correct filename for iCal download', () => {
		const createElementSpy = vi.spyOn(document, 'createElement')

		render(<CalendarExport {...mockEvent} />)

		const icalButton = screen.getByText('Download iCal')
		fireEvent.click(icalButton)

		// Find the anchor element from the createElement calls
		const anchorCallIndex = createElementSpy.mock.calls.findIndex((call) => call[0] === 'a')
		expect(anchorCallIndex).not.toBe(-1)

		const linkElement = createElementSpy.mock.results[anchorCallIndex]
			?.value as HTMLAnchorElement
		expect(linkElement).toBeInstanceOf(HTMLAnchorElement)
		expect(linkElement.download).toBe('test_event.ics')

		createElementSpy.mockRestore()
	})
})
