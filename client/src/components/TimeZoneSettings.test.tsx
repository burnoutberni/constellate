import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TimeZoneSettings } from './TimeZoneSettings'

// Mock fetch
global.fetch = vi.fn()

// Mock timezones module
vi.mock('../lib/timezones', () => ({
  getDefaultTimezone: () => 'UTC',
  getSupportedTimezones: () => ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'],
}))

describe('TimeZoneSettings Component', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  const mockProfile = {
    timezone: 'America/New_York',
  }

  const renderComponent = (profile = mockProfile, userId = 'user-1') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TimeZoneSettings profile={profile} userId={userId} />
      </QueryClientProvider>
    )
  }

  it('should render timezone settings', () => {
    renderComponent()

    expect(screen.getByText('Time & Region')).toBeInTheDocument()
    expect(screen.getByLabelText('Preferred timezone')).toBeInTheDocument()
  })

  it('should show current timezone', () => {
    renderComponent()

    const select = screen.getByLabelText('Preferred timezone')
    expect(select).toHaveValue('America/New_York')
  })

  it('should show timezone options', () => {
    renderComponent()

    const select = screen.getByLabelText('Preferred timezone') as HTMLSelectElement
    const options = Array.from(select.options).map(opt => opt.value)

    expect(options).toContain('UTC')
    expect(options).toContain('America/New_York')
    expect(options).toContain('Europe/London')
    expect(options).toContain('Asia/Tokyo')
  })

  it('should display current timezone in description', () => {
    renderComponent()

    expect(screen.getByText(/times currently shown in/i)).toBeInTheDocument()
    // Check that timezone appears in the description (will match multiple, but that's ok)
    const timezoneTexts = screen.getAllByText('America/New_York')
    expect(timezoneTexts.length).toBeGreaterThan(0)
  })
})
