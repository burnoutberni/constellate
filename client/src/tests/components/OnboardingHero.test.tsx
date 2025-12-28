import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { OnboardingHero } from '../../components/Feed/OnboardingHero'
import { createTestWrapper } from '../testUtils'

const mockSuggestions = [
    { id: 'u1', username: 'alice', name: 'Alice', profileImage: null, displayColor: '#f00' },
    { id: 'u2', username: 'bob', name: 'Bob', profileImage: null, displayColor: '#0f0' }
]

const { wrapper } = createTestWrapper()

describe('OnboardingHero', () => {
    it('should render welcome message', () => {
        render(<OnboardingHero suggestions={[]} />, { wrapper })
        expect(screen.getByText(/Welcome to Constellate/i)).toBeInTheDocument()
    })

    it('should display suggestions', () => {
        render(<OnboardingHero suggestions={mockSuggestions} />, { wrapper })
        expect(screen.getByText('Alice')).toBeInTheDocument()
        expect(screen.getByText('Bob')).toBeInTheDocument()
    })
})
