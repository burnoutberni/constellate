import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NotificationSettings } from '../../components/NotificationSettings'

describe('NotificationSettings Component', () => {
    it('should render all notification type toggles', () => {
        render(<NotificationSettings />)

        expect(screen.getByText('New Followers')).toBeInTheDocument()
        expect(screen.getByText('Comments')).toBeInTheDocument()
        expect(screen.getByText('Likes')).toBeInTheDocument()
        expect(screen.getByText('Mentions')).toBeInTheDocument()
        expect(screen.getByText('Event Updates')).toBeInTheDocument()
        expect(screen.getByText('System Notifications')).toBeInTheDocument()
    })

    it('should initialize all toggles as enabled by default', () => {
        render(<NotificationSettings />)

        const switches = screen.getAllByRole('switch')
        switches.forEach((switchElement) => {
            expect(switchElement).toHaveAttribute('aria-checked', 'true')
        })
    })

    it('should toggle notification preference when clicked', () => {
        render(<NotificationSettings />)

        const followSwitch = screen.getByRole('switch', { name: /new followers/i })
        expect(followSwitch).toHaveAttribute('aria-checked', 'true')

        fireEvent.click(followSwitch)
        expect(followSwitch).toHaveAttribute('aria-checked', 'false')

        fireEvent.click(followSwitch)
        expect(followSwitch).toHaveAttribute('aria-checked', 'true')
    })

    it('should show save button when preferences change', () => {
        render(<NotificationSettings />)

        expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument()

        const followSwitch = screen.getByRole('switch', { name: /new followers/i })
        fireEvent.click(followSwitch)

        expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    })

    it('should call onUpdate when save button is clicked', () => {
        const onUpdate = vi.fn()
        render(<NotificationSettings onUpdate={onUpdate} />)

        const followSwitch = screen.getByRole('switch', { name: /new followers/i })
        fireEvent.click(followSwitch)

        const saveButton = screen.getByRole('button', { name: /save changes/i })
        fireEvent.click(saveButton)

        expect(onUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                FOLLOW: false,
                COMMENT: true,
                LIKE: true,
                MENTION: true,
                EVENT: true,
                SYSTEM: true,
            })
        )
    })

    it('should hide save button after saving', () => {
        const onUpdate = vi.fn()
        render(<NotificationSettings onUpdate={onUpdate} />)

        const followSwitch = screen.getByRole('switch', { name: /new followers/i })
        fireEvent.click(followSwitch)

        const saveButton = screen.getByRole('button', { name: /save changes/i })
        fireEvent.click(saveButton)

        expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument()
    })

    it('should reset preferences when cancel is clicked', () => {
        render(<NotificationSettings />)

        const followSwitch = screen.getByRole('switch', { name: /new followers/i })
        fireEvent.click(followSwitch)
        expect(followSwitch).toHaveAttribute('aria-checked', 'false')

        const cancelButton = screen.getByRole('button', { name: /cancel/i })
        fireEvent.click(cancelButton)

        expect(followSwitch).toHaveAttribute('aria-checked', 'true')
    })

    it('should enable all notifications when "Enable All" is clicked', () => {
        render(<NotificationSettings />)

        // Disable a few switches first
        const followSwitch = screen.getByRole('switch', { name: /new followers/i })
        const commentSwitch = screen.getByRole('switch', { name: /comments/i })
        fireEvent.click(followSwitch)
        fireEvent.click(commentSwitch)

        expect(followSwitch).toHaveAttribute('aria-checked', 'false')
        expect(commentSwitch).toHaveAttribute('aria-checked', 'false')

        const enableAllButton = screen.getByRole('button', { name: /enable all/i })
        fireEvent.click(enableAllButton)

        const switches = screen.getAllByRole('switch')
        switches.forEach((switchElement) => {
            expect(switchElement).toHaveAttribute('aria-checked', 'true')
        })
    })

    it('should disable all notifications when "Disable All" is clicked', () => {
        render(<NotificationSettings />)

        const disableAllButton = screen.getByRole('button', { name: /disable all/i })
        fireEvent.click(disableAllButton)

        const switches = screen.getAllByRole('switch')
        switches.forEach((switchElement) => {
            expect(switchElement).toHaveAttribute('aria-checked', 'false')
        })
    })

    it('should initialize with provided preferences', () => {
        const preferences = {
            FOLLOW: false,
            COMMENT: true,
            LIKE: false,
            MENTION: true,
            EVENT: true,
            SYSTEM: false,
        }

        render(<NotificationSettings preferences={preferences} />)

        const followSwitch = screen.getByRole('switch', { name: /new followers/i })
        const commentSwitch = screen.getByRole('switch', { name: /comments/i })
        const likeSwitch = screen.getByRole('switch', { name: /likes/i })

        expect(followSwitch).toHaveAttribute('aria-checked', 'false')
        expect(commentSwitch).toHaveAttribute('aria-checked', 'true')
        expect(likeSwitch).toHaveAttribute('aria-checked', 'false')
    })

    it('should disable all controls when loading', () => {
        render(<NotificationSettings loading />)

        const switches = screen.getAllByRole('switch')
        switches.forEach((switchElement) => {
            expect(switchElement).toBeDisabled()
        })

        const enableAllButton = screen.getByRole('button', { name: /enable all/i })
        const disableAllButton = screen.getByRole('button', { name: /disable all/i })

        expect(enableAllButton).toBeDisabled()
        expect(disableAllButton).toBeDisabled()
    })
})
