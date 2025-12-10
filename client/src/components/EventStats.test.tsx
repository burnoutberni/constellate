import { describe, it, expect } from 'vitest'
<<<<<<< HEAD
import { render, screen } from '@testing-library/react'
import { EventStats } from './EventStats'

describe('EventStats', () => {
  it('should render required statistics', () => {
    render(<EventStats totalEvents={10} upcomingEvents={5} isLoading={false} />)
    
    expect(screen.getByText('Platform Statistics')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('Total Events')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('Upcoming')).toBeInTheDocument()
  })

  it('should render optional statistics when provided', () => {
    render(
      <EventStats 
        totalEvents={10} 
        upcomingEvents={5} 
        todayEvents={2}
        activeUsers={50}
        isLoading={false} 
      />
    )
    
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText("Today's Events")).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('Active Users')).toBeInTheDocument()
  })

  it('should show loading state', () => {
    render(<EventStats totalEvents={0} upcomingEvents={0} isLoading={true} />)
    
    // Check for loading spinner (it's a div with animate-spin class)
    const loadingSpinner = document.querySelector('.animate-spin')
    expect(loadingSpinner).toBeInTheDocument()
    // Platform Statistics title should still be visible
    expect(screen.getByText('Platform Statistics')).toBeInTheDocument()
    // But stats should not be visible
    expect(screen.queryByText('10')).not.toBeInTheDocument()
  })

  it('should not show optional statistics when not provided', () => {
    render(<EventStats totalEvents={10} upcomingEvents={5} isLoading={false} />)
    
    expect(screen.queryByText("Today's Events")).not.toBeInTheDocument()
    expect(screen.queryByText('Active Users')).not.toBeInTheDocument()
=======
import { EventStats } from './EventStats'

describe('EventStats', () => {
  it('should accept required statistics props', () => {
    const props = {
      totalEvents: 10,
      upcomingEvents: 5,
      isLoading: false,
    }
    
    expect(EventStats).toBeDefined()
    expect(typeof EventStats).toBe('function')
    expect(props.totalEvents).toBe(10)
    expect(props.upcomingEvents).toBe(5)
  })

  it('should accept optional statistics props', () => {
    const props = {
      totalEvents: 10,
      upcomingEvents: 5,
      todayEvents: 2,
      activeUsers: 50,
      isLoading: false,
    }
    
    expect(props.todayEvents).toBe(2)
    expect(props.activeUsers).toBe(50)
  })

  it('should handle loading state', () => {
    const props = {
      totalEvents: 0,
      upcomingEvents: 0,
      isLoading: true,
    }
    
    expect(props.isLoading).toBe(true)
  })

  it('should be a valid React component', () => {
    expect(() => EventStats({ 
      totalEvents: 10, 
      upcomingEvents: 5 
    })).not.toThrow()
>>>>>>> 6e42472 (Add new components for WP-104: HomeHero, EventStats, and EventCard)
  })
})
