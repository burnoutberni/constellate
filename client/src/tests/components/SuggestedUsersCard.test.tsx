import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SuggestedUsersCard } from '../../components/Feed/SuggestedUsersCard'
import { createTestWrapper } from '../testUtils'

const mockUsers = [
    { id: 'u1', username: 'alice', name: 'Alice', profileImage: null, displayColor: '#f00' },
    { id: 'u2', username: 'bob', name: 'Bob', profileImage: null, displayColor: '#0f0' }
]

const { wrapper } = createTestWrapper()

describe('SuggestedUsersCard', () => {
    it('should render suggestions with correct links', () => {
        render(<SuggestedUsersCard users={mockUsers} />, { wrapper })

        expect(screen.getByText('Alice')).toBeInTheDocument()
        expect(screen.getByText('@alice')).toBeInTheDocument()

        // precise link checks 
        const aliceLinks = screen.getAllByRole('link', { name: /alice/i })
        // One for avatar, one for name. Both should point to profile
        aliceLinks.forEach(link => {
            expect(link).toHaveAttribute('href', '/@alice')
        })

        expect(screen.getByText('Bob')).toBeInTheDocument()
    })
})
