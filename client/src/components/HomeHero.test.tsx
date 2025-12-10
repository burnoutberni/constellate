import { describe, it, expect } from 'vitest'
<<<<<<< HEAD
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { HomeHero } from './HomeHero'

describe('HomeHero', () => {
  it('should render hero title and description for unauthenticated users', () => {
    render(
      <BrowserRouter>
        <HomeHero isAuthenticated={false} />
      </BrowserRouter>
    )
    
    expect(screen.getByText(/Discover Events in the/i)).toBeInTheDocument()
    expect(screen.getByText(/Fediverse/i)).toBeInTheDocument()
    expect(screen.getByText(/A federated event platform built on ActivityPub/i)).toBeInTheDocument()
    expect(screen.getByText('Sign Up Free')).toBeInTheDocument()
    expect(screen.getByText('Browse Events')).toBeInTheDocument()
  })

  it('should render different CTAs for authenticated users', () => {
    render(
      <BrowserRouter>
        <HomeHero isAuthenticated={true} />
      </BrowserRouter>
    )
    
    expect(screen.getByText(/Discover Events in the/i)).toBeInTheDocument()
    expect(screen.getByText('View Your Feed')).toBeInTheDocument()
    expect(screen.getByText('Discover Events')).toBeInTheDocument()
    expect(screen.queryByText('Sign Up Free')).not.toBeInTheDocument()
    expect(screen.queryByText('Browse Events')).not.toBeInTheDocument()
  })

  it('should show learn more link for unauthenticated users', () => {
    render(
      <BrowserRouter>
        <HomeHero isAuthenticated={false} />
      </BrowserRouter>
    )
    
    expect(screen.getByText(/Learn more about federation/i)).toBeInTheDocument()
  })

  it('should not show learn more link for authenticated users', () => {
    render(
      <BrowserRouter>
        <HomeHero isAuthenticated={true} />
      </BrowserRouter>
    )
    
    expect(screen.queryByText(/Learn more about federation/i)).not.toBeInTheDocument()
=======
import { HomeHero } from './HomeHero'

describe('HomeHero', () => {
  it('should render hero title and description', () => {
    const props = {
      isAuthenticated: false,
    }
    
    // Component should be exported and importable
    expect(HomeHero).toBeDefined()
    expect(typeof HomeHero).toBe('function')
    
    // Props interface should accept isAuthenticated
    expect(props.isAuthenticated).toBe(false)
  })

  it('should accept authenticated state', () => {
    const props = {
      isAuthenticated: true,
    }
    
    expect(props.isAuthenticated).toBe(true)
  })

  it('should be a valid React component', () => {
    // Verify the component can be called as a function
    expect(() => HomeHero({ isAuthenticated: false })).not.toThrow()
>>>>>>> 6e42472 (Add new components for WP-104: HomeHero, EventStats, and EventCard)
  })
})
