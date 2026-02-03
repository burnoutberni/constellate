import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchBar } from '../../components/SearchBar'
import { BrowserRouter } from 'react-router-dom'

// Mock dependencies
vi.mock('@/lib/api-client', () => ({
    api: {
        get: vi.fn().mockResolvedValue({ users: [], events: [], remoteAccountSuggestion: null }),
        post: vi.fn(),
    }
}))

vi.mock('@/design-system', () => ({
    useThemeColors: () => ({ info: { 500: '#000000' } })
}))

describe('SearchBar', () => {
    it('should show clear button when there is text', async () => {
        render(
            <BrowserRouter>
                <SearchBar />
            </BrowserRouter>
        )

        const input = screen.getByPlaceholderText(/Search events, users/i)
        fireEvent.change(input, { target: { value: 'test' } })

        // The clear button should appear. It's the only button in the initial state (search icon is not a button)
        const clearButton = await screen.findByRole('button')
        expect(clearButton).toBeInTheDocument()
    })

    it('should clear text when clear button is clicked', async () => {
         render(
            <BrowserRouter>
                <SearchBar />
            </BrowserRouter>
        )

        const input = screen.getByPlaceholderText(/Search events, users/i) as HTMLInputElement
        fireEvent.change(input, { target: { value: 'test' } })

        const clearButton = await screen.findByRole('button')
        fireEvent.click(clearButton)

        expect(input.value).toBe('')
        expect(input).toHaveFocus()
    })
})
