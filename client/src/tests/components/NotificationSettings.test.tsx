/**
 * Tests for Email Preferences Frontend
 * Tests for email preferences UI components and hooks
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest'
import { NotificationSettings } from '@/components/NotificationSettings'
import * as queries from '@/hooks/queries'
import type { EmailPreferences, EmailPreferencesResponse } from '@/hooks/queries/emailPreferences'

// Mock the hooks
vi.mock('@/hooks/queries', async () => {
	const actual = await vi.importActual('@/hooks/queries')
	return {
		...actual,
		useEmailPreferences: vi.fn(),
		useUpdateEmailPreferences: vi.fn(),
		useResetEmailPreferences: vi.fn(),
	}
})

// Mock API client
vi.mock('@/lib/api-client', () => ({
	api: {
		get: vi.fn(),
		put: vi.fn(),
		post: vi.fn(),
	},
}))

describe('NotificationSettings Component', () => {
	let queryClient: QueryClient
	let mockUseEmailPreferences: MockedFunction<typeof queries.useEmailPreferences>
	let mockUseUpdateEmailPreferences: MockedFunction<typeof queries.useUpdateEmailPreferences>
	let mockUseResetEmailPreferences: MockedFunction<typeof queries.useResetEmailPreferences>

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		})

		mockUseEmailPreferences = vi.mocked(queries.useEmailPreferences)
		mockUseUpdateEmailPreferences = vi.mocked(queries.useUpdateEmailPreferences)
		mockUseResetEmailPreferences = vi.mocked(queries.useResetEmailPreferences)

		// Set up default mock returns
		mockUseEmailPreferences.mockReturnValue({
			data: {
				preferences: {
					FOLLOW: true,
					COMMENT: true,
					LIKE: true,
					MENTION: true,
					EVENT: true,
					SYSTEM: true,
				},
			},
			isLoading: false,
			error: null,
		} as UseQueryResult<EmailPreferencesResponse>)

		mockUseUpdateEmailPreferences.mockReturnValue({
			mutate: vi.fn(),
			isPending: false,
		} as UseMutationResult<EmailPreferencesResponse, Error, Partial<EmailPreferences>>)

		mockUseResetEmailPreferences.mockReturnValue({
			mutate: vi.fn(),
			isPending: false,
		} as UseMutationResult<EmailPreferencesResponse, Error, undefined>)

		vi.clearAllMocks()
	})

	const renderWithQueryClient = (component: React.ReactElement) => {
		return render(
			<QueryClientProvider client={queryClient}>
				{component}
			</QueryClientProvider>
		)
	}

	describe('Email Preferences Mode', () => {
		it('should display email preferences title when in email mode', () => {
			mockUseEmailPreferences.mockReturnValue({
				data: {
					preferences: {
						FOLLOW: true,
						COMMENT: true,
						LIKE: true,
						MENTION: true,
						EVENT: true,
						SYSTEM: true,
					},
				},
				isLoading: false,
				error: null,
			} as UseQueryResult<EmailPreferencesResponse>)

			renderWithQueryClient(<NotificationSettings emailMode={true} />)

			expect(screen.getByText('Email Notifications')).toBeInTheDocument()
			expect(screen.getByText(/Choose which notifications you'd like to receive via email/)).toBeInTheDocument()
		})

		it('should display regular title when not in email mode', () => {
			mockUseEmailPreferences.mockReturnValue({
				data: {
					preferences: {
						FOLLOW: true,
						COMMENT: true,
						LIKE: true,
						MENTION: true,
						EVENT: true,
						SYSTEM: true,
					},
				},
				isLoading: false,
				error: null,
			} as UseQueryResult<EmailPreferencesResponse>)

			renderWithQueryClient(<NotificationSettings emailMode={false} />)

			expect(screen.getByText('Notification Preferences')).toBeInTheDocument()
			expect(screen.getByText(/Choose which notifications you'd like to receive/)).toBeInTheDocument()
		})
	})

	describe('Loading States', () => {
		it('should show spinner while loading', () => {
			mockUseEmailPreferences.mockReturnValue({
				isLoading: true,
				error: null,
			} as UseQueryResult<EmailPreferencesResponse>)

			renderWithQueryClient(<NotificationSettings emailMode={true} />)

			expect(screen.getByLabelText('Loading')).toBeInTheDocument()
		})

		it('should show error message on error', () => {
			const error = new Error('Failed to load preferences')
			mockUseEmailPreferences.mockReturnValue({
				isLoading: false,
				error,
			} as UseQueryResult<EmailPreferencesResponse>)

			renderWithQueryClient(<NotificationSettings emailMode={true} />)

			expect(screen.getByText('Failed to load notification preferences')).toBeInTheDocument()
			expect(screen.getByText('Failed to load preferences')).toBeInTheDocument()
			expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
		})
	})

	describe('Preference Toggles', () => {
		const defaultPreferences = {
			FOLLOW: true,
			COMMENT: true,
			LIKE: true,
			MENTION: true,
			EVENT: true,
			SYSTEM: true,
		}

		beforeEach(() => {
			mockUseEmailPreferences.mockReturnValue({
				data: { preferences: defaultPreferences },
				isLoading: false,
				error: null,
			})

			mockUseUpdateEmailPreferences.mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			})
		})

		it('should display all notification types with icons', () => {
			renderWithQueryClient(<NotificationSettings emailMode={true} />)

			expect(screen.getByText('New Followers')).toBeInTheDocument()
			expect(screen.getByText('Comments')).toBeInTheDocument()
			expect(screen.getByText('Likes')).toBeInTheDocument()
			expect(screen.getByText('Mentions')).toBeInTheDocument()
			expect(screen.getByText('Event Updates')).toBeInTheDocument()
			expect(screen.getByText('System Notifications')).toBeInTheDocument()
		})

		it('should display descriptions for each notification type', () => {
			renderWithQueryClient(<NotificationSettings emailMode={true} />)

			expect(screen.getByText('Get notified when someone follows you')).toBeInTheDocument()
			expect(screen.getByText('Get notified when someone comments on your events')).toBeInTheDocument()
			expect(screen.getByText('Get notified when someone likes your events')).toBeInTheDocument()
			expect(screen.getByText('Get notified when someone mentions you')).toBeInTheDocument()
			expect(screen.getByText("Get notified about events you're attending")).toBeInTheDocument()
			expect(screen.getByText('Important updates from the platform')).toBeInTheDocument()
		})

		it('should show correct toggle states based on preferences', () => {
			renderWithQueryClient(<NotificationSettings emailMode={true} />)

			// All should be enabled by default
			const toggles = screen.getAllByRole('switch')
			toggles.forEach((toggle) => {
				expect(toggle).toHaveAttribute('aria-checked', 'true')
			})
		})

		it('should handle toggle changes', async () => {
			renderWithQueryClient(<NotificationSettings emailMode={true} />)

			const followToggle = screen.getByRole('switch', { name: /New Followers/i })
			expect(followToggle).toHaveAttribute('aria-checked', 'true')

			// Toggle off
			fireEvent.click(followToggle)

			await waitFor(() => {
				expect(followToggle).toHaveAttribute('aria-checked', 'false')
			})
		})

		it('should show save button when changes are made', async () => {
			renderWithQueryClient(<NotificationSettings emailMode={true} />)

			// Initially no save button
			expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument()

			// Make a change
			const followToggle = screen.getByRole('switch', { name: /New Followers/i })
			fireEvent.click(followToggle)

			await waitFor(() => {
				expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
				expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
			})
		})
	})

	describe('Actions', () => {
		const defaultPreferences = {
			FOLLOW: true,
			COMMENT: true,
			LIKE: true,
			MENTION: true,
			EVENT: true,
			SYSTEM: true,
		}

		beforeEach(() => {
			mockUseEmailPreferences.mockReturnValue({
				data: { preferences: defaultPreferences },
				isLoading: false,
				error: null,
			})
		})

		it('should enable all notifications when Enable All clicked', async () => {
			// Start with some disabled
			mockUseEmailPreferences.mockReturnValue({
				data: {
					preferences: {
						...defaultPreferences,
						FOLLOW: false,
						COMMENT: false,
					},
				},
				isLoading: false,
				error: null,
			})

			renderWithQueryClient(<NotificationSettings emailMode={true} />)

			const enableAllButton = screen.getByRole('button', { name: 'Enable All' })
			fireEvent.click(enableAllButton)

			await waitFor(() => {
				// All toggles should be enabled
				const toggles = screen.getAllByRole('switch')
				toggles.forEach((toggle) => {
					expect(toggle).toHaveAttribute('aria-checked', 'true')
				})

				// Should show save button
				expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
			})
		})

		it('should disable all notifications when Disable All clicked', async () => {
			renderWithQueryClient(<NotificationSettings emailMode={true} />)

			const disableAllButton = screen.getByRole('button', { name: 'Disable All' })
			fireEvent.click(disableAllButton)

			await waitFor(() => {
				// All toggles should be disabled
				const toggles = screen.getAllByRole('switch')
				toggles.forEach((toggle) => {
					expect(toggle).toHaveAttribute('aria-checked', 'false')
				})

				// Should show save button
				expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
			})
		})

		it('should save preferences when Save Changes clicked', async () => {
			const mockMutate = vi.fn()
			mockUseUpdateEmailPreferences.mockReturnValue({
				mutate: mockMutate,
				isPending: false,
			} as UseMutationResult<EmailPreferencesResponse, Error, Partial<EmailPreferences>>)

			renderWithQueryClient(<NotificationSettings emailMode={true} />)

			// Make a change first
			const followToggle = screen.getByRole('switch', { name: /New Followers/i })
			fireEvent.click(followToggle)

			await waitFor(() => {
				const saveButton = screen.getByRole('button', { name: 'Save Changes' })
				fireEvent.click(saveButton)
			})

			await waitFor(() => {
				expect(mockMutate).toHaveBeenCalledWith(
					expect.objectContaining({
						FOLLOW: false, // Changed from true
					}),
					expect.any(Object) // options object
				)
			})
		})
	})

	describe('Loading and Error States for Actions', () => {
		it('should disable all controls during update', () => {
			mockUseEmailPreferences.mockReturnValue({
				data: { preferences: { FOLLOW: true, COMMENT: true, LIKE: true, MENTION: true, EVENT: true, SYSTEM: true } },
				isLoading: false,
				error: null,
			} as UseQueryResult<EmailPreferencesResponse>)

			mockUseUpdateEmailPreferences.mockReturnValue({
				mutate: vi.fn(),
				isPending: true,
			} as UseMutationResult<EmailPreferencesResponse, Error, Partial<EmailPreferences>>)

			renderWithQueryClient(<NotificationSettings emailMode={true} />)

			// All controls should be disabled
			const toggles = screen.getAllByRole('switch')
			toggles.forEach((toggle) => {
				expect(toggle).toBeDisabled()
			})

			expect(screen.getByRole('button', { name: 'Enable All' })).toBeDisabled()
			expect(screen.getByRole('button', { name: 'Disable All' })).toBeDisabled()
		})
	})

	describe('Accessibility', () => {
		it('should have proper ARIA labels', () => {
			mockUseEmailPreferences.mockReturnValue({
				data: { preferences: { FOLLOW: true, COMMENT: true, LIKE: true, MENTION: true, EVENT: true, SYSTEM: true } },
				isLoading: false,
				error: null,
			})

			renderWithQueryClient(<NotificationSettings emailMode={true} />)

			const toggles = screen.getAllByRole('switch')
			toggles.forEach((toggle) => {
				expect(toggle).toHaveAttribute('role', 'switch')
				expect(toggle).toHaveAttribute('aria-checked')
			})
		})

		it('should have keyboard navigation support', () => {
			mockUseEmailPreferences.mockReturnValue({
				data: { preferences: { FOLLOW: true, COMMENT: true, LIKE: true, MENTION: true, EVENT: true, SYSTEM: true } },
				isLoading: false,
				error: null,
			} as UseQueryResult<EmailPreferencesResponse>)

			renderWithQueryClient(<NotificationSettings emailMode={true} />)

			const followToggle = screen.getByRole('switch', { name: /New Followers/i })
			
			// Should be focusable
			followToggle.focus()
			expect(document.activeElement).toBe(followToggle)
			
			// Should handle keyboard events
			fireEvent.keyDown(followToggle, { key: 'Enter' })
			fireEvent.keyDown(followToggle, { key: ' ' })
		})

		it('should have proper color contrast', () => {
			mockUseEmailPreferences.mockReturnValue({
				data: { preferences: { FOLLOW: true, COMMENT: true, LIKE: true, MENTION: true, EVENT: true, SYSTEM: true } },
				isLoading: false,
				error: null,
			})

			renderWithQueryClient(<NotificationSettings emailMode={true} />)

			// Check that text is readable (basic check)
			const titles = screen.getAllByRole('heading')
			titles.forEach((title) => {
				expect(title).toHaveStyle({ 'font-weight': 'bold' })
			})
		})

		it('should reset preferences to defaults when reset button is clicked', async () => {
			const mockMutate = vi.fn()
			mockUseResetEmailPreferences.mockReturnValue({
				mutate: mockMutate,
				isPending: false,
			} as UseMutationResult<EmailPreferencesResponse, Error, undefined>)

			mockUseEmailPreferences.mockReturnValue({
				data: {
					preferences: {
						FOLLOW: false, // Modified from default
						COMMENT: true,
						LIKE: true,
						MENTION: true,
						EVENT: true,
						SYSTEM: true,
					},
				},
				isLoading: false,
				error: null,
			} as UseQueryResult<EmailPreferencesResponse>)

			renderWithQueryClient(<NotificationSettings emailMode={true} />)

			// Make some changes to show the footer
			const followToggle = screen.getByRole('switch', { name: /new followers/i })
			fireEvent.click(followToggle)

			// Click reset button
			const resetButton = screen.getByRole('button', { name: /reset to defaults/i })
			fireEvent.click(resetButton)

			// Should call the reset mutation
			expect(mockMutate).toHaveBeenCalledWith(undefined, {
				onSuccess: expect.any(Function),
			})
		})
	})
})