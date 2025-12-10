import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MentionAutocomplete, MentionSuggestion } from './MentionAutocomplete'

const mockSuggestions: MentionSuggestion[] = [
    {
        id: '1',
        username: 'alice',
        name: 'Alice Smith',
        profileImage: null,
        displayColor: null,
    },
    {
        id: '2',
        username: 'bob',
        name: 'Bob Jones',
        profileImage: null,
        displayColor: null,
    },
]

describe('MentionAutocomplete Component', () => {
    it('should not render when visible is false', () => {
        const { container } = render(
            <MentionAutocomplete
                suggestions={mockSuggestions}
                activeIndex={0}
                onSelect={vi.fn()}
                visible={false}
            />
        )

        expect(container).toBeEmptyDOMElement()
    })

    it('should not render when suggestions array is empty', () => {
        const { container } = render(
            <MentionAutocomplete
                suggestions={[]}
                activeIndex={0}
                onSelect={vi.fn()}
                visible={true}
            />
        )

        expect(container).toBeEmptyDOMElement()
    })

    it('should render suggestions when visible', () => {
        render(
            <MentionAutocomplete
                suggestions={mockSuggestions}
                activeIndex={0}
                onSelect={vi.fn()}
                visible={true}
            />
        )

        expect(screen.getByText('Alice Smith')).toBeInTheDocument()
        expect(screen.getByText('@alice')).toBeInTheDocument()
        expect(screen.getByText('Bob Jones')).toBeInTheDocument()
        expect(screen.getByText('@bob')).toBeInTheDocument()
    })

    it('should highlight active suggestion', () => {
        render(
            <MentionAutocomplete
                suggestions={mockSuggestions}
                activeIndex={1}
                onSelect={vi.fn()}
                visible={true}
            />
        )

        const buttons = screen.getAllByRole('button')
        expect(buttons[0]).not.toHaveClass('bg-primary-50')
        expect(buttons[1]).toHaveClass('bg-primary-50')
    })

    it('should call onSelect when suggestion is clicked', async () => {
        const user = userEvent.setup()
        const mockSelect = vi.fn()
        render(
            <MentionAutocomplete
                suggestions={mockSuggestions}
                activeIndex={0}
                onSelect={mockSelect}
                visible={true}
            />
        )

        const firstButton = screen.getByText('Alice Smith').closest('button')!
        await user.click(firstButton)

        expect(mockSelect).toHaveBeenCalledWith(mockSuggestions[0])
    })

    it('should show username when name is not available', () => {
        const suggestionsWithoutName: MentionSuggestion[] = [
            {
                id: '1',
                username: 'noname',
                name: null,
                profileImage: null,
                displayColor: null,
            },
        ]

        render(
            <MentionAutocomplete
                suggestions={suggestionsWithoutName}
                activeIndex={0}
                onSelect={vi.fn()}
                visible={true}
            />
        )

        expect(screen.getByText('noname')).toBeInTheDocument()
        expect(screen.getByText('@noname')).toBeInTheDocument()
    })
})
