import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchBar } from '../../components/SearchBar'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '../../design-system'

// Mock api
vi.mock('@/lib/api-client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('SearchBar', () => {
  it('renders correctly', () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <SearchBar />
        </MemoryRouter>
      </ThemeProvider>
    )
    expect(screen.getByPlaceholderText(/search events, users/i)).toBeInTheDocument()
  })

  it('shows clear button when text is entered and clears it on click', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <MemoryRouter>
          <SearchBar />
        </MemoryRouter>
      </ThemeProvider>
    )

    const input = screen.getByPlaceholderText(/search events, users/i)
    await user.type(input, 'test query')

    expect(input).toHaveValue('test query')

    // Check for clear button
    // We need to wait for the debounce and API call to finish so loading state is false
    const clearButton = await screen.findByRole('button', { name: /clear search/i }, { timeout: 1000 })
    expect(clearButton).toBeInTheDocument()

    // Click clear
    await user.click(clearButton)

    expect(input).toHaveValue('')
    expect(input).toHaveFocus()

    // Clear button should disappear
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument()
  })
})
