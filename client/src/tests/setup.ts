import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, afterAll, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
	// Ensure we're using real timers (in case a test left fake timers active)
	// This prevents timers from preventing process exit
	if (vi.isFakeTimers()) {
		vi.useRealTimers()
	}

	// Clear all timers
	vi.clearAllTimers()

	// Cleanup React components and DOM
	cleanup()

	// Clear all mocks to free memory
	vi.clearAllMocks()

	// Note: global.gc() is NOT called here as it's extremely slow when called after every test
	// and can cause test suite to hang. Memory cleanup is handled by:
	// - QueryClient.clear() in individual test files
	// - React cleanup() above
	// - vi.clearAllMocks() above
})

// Global teardown to ensure all resources are cleaned up and process can exit
afterAll(async () => {
	// Ensure real timers are active (critical for process exit)
	if (vi.isFakeTimers()) {
		vi.useRealTimers()
	}

	// Clear any remaining timers
	vi.clearAllTimers()

	// Clear all mocks one final time
	vi.clearAllMocks()

	// Small delay to allow pending operations to complete
	await new Promise((resolve) => setTimeout(resolve, 50))
})

// Mock window.matchMedia for tests that need it
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(), // deprecated
		removeListener: vi.fn(), // deprecated
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
})

// Mock fetch globally to prevent real network calls
// Use globalThis which works in both browser and Node.js environments
// Safely get the global object - globalThis is available in all modern environments
const globalObj = globalThis
globalObj.fetch = vi.fn(() =>
	Promise.resolve({
		ok: true,
		json: async () => ({}),
		blob: async () => new Blob(),
	} as Response)
)

// Mock EventSource for useRealtime hook (jsdom doesn't have EventSource)
globalObj.EventSource = class EventSource {
	static readonly CONNECTING = 0
	static readonly OPEN = 1
	static readonly CLOSED = 2

	constructor() {}
	close() {}
	addEventListener() {}
	removeEventListener() {}
	dispatchEvent() {
		return false
	}
	onerror = null
	onmessage = null
	onopen = null
	readyState = 0
	withCredentials = false
} as unknown as typeof EventSource
