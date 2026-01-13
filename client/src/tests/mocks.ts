// Global mocks to prevent API calls and speed up tests
// Note: vi is available globally in Vitest with globals: true
import { vi } from 'vitest'
import { createContext, type ReactNode } from 'react'

// Mock AuthContext globally - this provides a default mock that can be overridden in individual tests
// Path must match how source files import it: '../contexts/AuthContext' from pages/ or components/
// Vitest resolves mocks from source file location, so this path works for both
vi.mock('../contexts/AuthContext', () => {
	const mockAuthValue = {
		user: null,
		loading: false,
		login: vi.fn(),
		signup: vi.fn(),
		logout: vi.fn(),
	}
	return {
		AuthContext: createContext(mockAuthValue),
		AuthProvider: ({ children }: { children: ReactNode }) => children,
	}
})

// Mock useAuth hook globally - this is what components actually use
// Default returns null user, tests that need a user should mock this
vi.mock('../hooks/useAuth', () => ({
	useAuth: vi.fn(() => ({
		user: null,
		loading: false,
		login: vi.fn(),
		signup: vi.fn(),
		logout: vi.fn(),
	})),
}))

// Mock follow hooks to prevent API calls
// Path matches how components import it: '../hooks/queries/users' from components/
vi.mock('../hooks/queries/users', async () => {
	const actual = await vi.importActual('../hooks/queries/users')
	return {
		...actual,
		useFollowStatus: () => ({
			data: { isFollowing: false, isAccepted: false },
			isLoading: false,
		}),
		useFollowUser: () => ({
			mutate: vi.fn(),
			isPending: false,
		}),
		useUnfollowUser: () => ({
			mutate: vi.fn(),
			isPending: false,
		}),
	}
})
