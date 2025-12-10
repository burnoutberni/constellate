import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProfileSettings } from './ProfileSettings'

// Mock fetch
global.fetch = vi.fn()

describe('ProfileSettings Component', () => {
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
    id: 'user-1',
    username: 'testuser',
    name: 'Test User',
    bio: 'Test bio',
    profileImage: 'https://example.com/profile.jpg',
    headerImage: 'https://example.com/header.jpg',
    displayColor: '#3b82f6',
  }

  const renderComponent = (profile = mockProfile, userId = 'user-1') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ProfileSettings profile={profile} userId={userId} />
      </QueryClientProvider>
    )
  }

  it('should render profile settings form', () => {
    renderComponent()

    expect(screen.getByText('Profile Information')).toBeInTheDocument()
    expect(screen.getByLabelText('Display Name')).toHaveValue('Test User')
    expect(screen.getByLabelText('Bio')).toHaveValue('Test bio')
    expect(screen.getByLabelText('Profile Image URL')).toHaveValue('https://example.com/profile.jpg')
    expect(screen.getByLabelText('Header Image URL')).toHaveValue('https://example.com/header.jpg')
  })

  it('should show username in preview', () => {
    renderComponent()

    expect(screen.getByText('@testuser')).toBeInTheDocument()
  })

  it('should display save button as disabled when no changes', () => {
    renderComponent()

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    expect(saveButton).toBeDisabled()
  })

  it('should enable save button when form is modified', async () => {
    renderComponent()

    const nameInput = screen.getByLabelText('Display Name')
    fireEvent.change(nameInput, { target: { value: 'New Name' } })

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /save changes/i })
      expect(saveButton).not.toBeDisabled()
    })
  })

  it('should show character count for bio', () => {
    renderComponent()

    expect(screen.getByText('8/500 characters')).toBeInTheDocument()
  })

  it('should update character count when typing in bio', () => {
    renderComponent()

    const bioInput = screen.getByLabelText('Bio')
    fireEvent.change(bioInput, { target: { value: 'New bio text' } })

    expect(screen.getByText('12/500 characters')).toBeInTheDocument()
  })

  it('should display color picker with current color', () => {
    renderComponent()

    const colorInputs = screen.getAllByDisplayValue('#3b82f6')
    const colorPicker = colorInputs.find(input => input.getAttribute('type') === 'color')
    expect(colorPicker).toBeDefined()
    expect(colorPicker).toHaveAttribute('type', 'color')
  })
})
