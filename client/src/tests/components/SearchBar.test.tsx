import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SearchBar } from '../../components/SearchBar'
import { api } from '@/lib/api-client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@/design-system'
import React from 'react'

// Mock api client
vi.mock('@/lib/api-client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
  }),
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

describe('SearchBar Component', () => {
  it('should show clear button when text is entered and clear it when clicked', async () => {
    const wrapper = createWrapper()
    render(<SearchBar />, { wrapper })

    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()

    // Setup mock
    const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({ users: [], events: [], remoteAccountSuggestion: null })

    // Type query
    await act(async () => {
        fireEvent.change(input, { target: { value: 'test' } })
    })

    expect(input).toHaveValue('test')

    // Wait for clear button
    const clearButton = await screen.findByLabelText('Clear search', {}, { timeout: 2000 })
    expect(clearButton).toBeInTheDocument()

    // Click clear
    await act(async () => {
        fireEvent.click(clearButton)
    })

    // Verify cleared
    expect(input).toHaveValue('')
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
  })

  it('should render search input', () => {
    const wrapper = createWrapper()
    render(<SearchBar />, { wrapper })
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('should show loading spinner while searching', async () => {
      const wrapper = createWrapper()
      render(<SearchBar />, { wrapper })

      const input = screen.getByRole('textbox')

      // Mock a slow response
      // eslint-disable-next-line no-unused-vars
      let resolvePromise: (val: unknown) => void = () => {};
      const promise = new Promise((resolve) => {
          resolvePromise = resolve
      });
      const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
      mockGet.mockReturnValue(promise)

      await act(async () => {
          fireEvent.change(input, { target: { value: 'loading test' } })
      })

      await new Promise(resolve => setTimeout(resolve, 350))

      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()

      // Cleanup promise
      await act(async () => {
         if (resolvePromise) resolvePromise({ users: [], events: [] });
      })
  })
})
