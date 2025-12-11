import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AccountSettings } from '../../components/AccountSettings'

// Mock useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: vi.fn(),
    sendMagicLink: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
  }),
}))

// Mock fetch
global.fetch = vi.fn()

describe('AccountSettings Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockProfile = {
    email: 'test@example.com',
    username: 'testuser',
  }

  const renderComponent = (profile = mockProfile) => {
    return render(<AccountSettings profile={profile} />)
  }

  it('should render account settings', () => {
    renderComponent()

    expect(screen.getByText('Account Management')).toBeInTheDocument()
    expect(screen.getByText('Email Address')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('should show change password button', () => {
    renderComponent()

    const changePasswordBtn = screen.getByRole('button', { name: /change password/i })
    expect(changePasswordBtn).toBeInTheDocument()
  })

  it('should show password form when change password is clicked', () => {
    renderComponent()

    const changePasswordBtn = screen.getByRole('button', { name: /change password/i })
    fireEvent.click(changePasswordBtn)

    expect(screen.getByLabelText('Current Password')).toBeInTheDocument()
    expect(screen.getByLabelText('New Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument()
  })

  it('should show delete account button', () => {
    renderComponent()

    const deleteBtn = screen.getByRole('button', { name: /delete account/i })
    expect(deleteBtn).toBeInTheDocument()
  })

  it('should show delete confirmation form when delete account is clicked', () => {
    renderComponent()

    const deleteBtn = screen.getByRole('button', { name: /delete account/i })
    fireEvent.click(deleteBtn)

    expect(screen.getByText(/type "testuser" to confirm/i)).toBeInTheDocument()
  })

  it('should show danger zone section', () => {
    renderComponent()

    expect(screen.getByText('Danger Zone')).toBeInTheDocument()
  })
})
