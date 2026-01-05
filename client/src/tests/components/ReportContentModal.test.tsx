// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll, type Mock } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportContentModal } from '../../components/ReportContentModal'
import { createTestWrapper } from '../testUtils'
import { api } from '../../lib/api-client'
// useUIStore unused

// Mock api
vi.mock('../../lib/api-client', () => ({
    api: {
        post: vi.fn(),
    },
}))

// Mock error handler
const mockHandleError = vi.fn()
vi.mock('../../hooks/useErrorHandler', () => ({
    useErrorHandler: () => mockHandleError,
}))

// Mock store
const mockAddToast = vi.fn()
vi.mock('../../stores', () => ({
    useUIStore: vi.fn((selector) => {
        if (selector.toString().includes('addToast')) return mockAddToast
        return undefined
    })
}))

describe('ReportContentModal', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        targetType: 'event' as const,
        targetId: 'evt-1',
        contentTitle: 'Bad Event'
    }

    beforeAll(() => {
        // Stub global matchMedia
        vi.stubGlobal('matchMedia', vi.fn((query) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(), // deprecated
            removeListener: vi.fn(), // deprecated
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })))
    })

    beforeEach(() => {
        vi.resetAllMocks()
        // Ensure matchMedia returns object even after reset if it was a spy
        // But stubGlobal replaces the function itself.
        // If resetAllMocks clears the implementation of the stubbed fn?
        // Yes, if it's a spy.
        // So we must re-implement if resetAllMocks clears it.
        const mm = window.matchMedia as unknown as Mock
        mm.mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }))
    })

    const renderModal = (props = defaultProps) => {
        const { wrapper } = createTestWrapper()
        const user = userEvent.setup()
        return {
            user,
            ...render(<ReportContentModal {...props} />, { wrapper })
        }
    }

    it('does not render when isOpen is false', () => {
        renderModal({ ...defaultProps, isOpen: false })
        expect(screen.queryByText('Report Content')).not.toBeInTheDocument()
    })

    it('renders correctly when open', () => {
        renderModal()
        expect(screen.getByText('Report Content')).toBeInTheDocument()
        expect(screen.getByText(/Bad Event/)).toBeInTheDocument()
        expect(screen.getByLabelText('Reason')).toBeInTheDocument()
        expect(screen.getByLabelText('Additional Details')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Submit Report' })).toBeInTheDocument()
    })

    it('validates input length', async () => {
        const { user } = renderModal()
        const submitBtn = screen.getByRole('button', { name: 'Submit Report' })
        const textarea = screen.getByLabelText('Additional Details')

        // Initially disabled (empty)
        expect(submitBtn).toBeDisabled()

        // Type short text
        await user.type(textarea, 'Short')
        expect(submitBtn).toBeDisabled()

        // Type long text
        await user.clear(textarea)
        await user.type(textarea, 'This is a long enough reason for reporting.')
        expect(submitBtn).toBeEnabled()
    })

    it('submits report successfully', async () => {
        const { user } = renderModal()
        const textarea = screen.getByLabelText('Additional Details')
        const submitBtn = screen.getByRole('button', { name: 'Submit Report' })

        await user.type(textarea, 'This is a valid report reason.')
        await user.click(submitBtn)

        expect(api.post).toHaveBeenCalledWith(
            '/report',
            expect.objectContaining({
                targetType: 'event',
                targetId: 'evt-1',
                reason: 'This is a valid report reason.',
                category: 'spam' // default
            }),
            undefined,
            expect.any(String)
        )

        expect(mockAddToast).toHaveBeenCalled()
        expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('handles change of category', async () => {
        const { user } = renderModal()
        const select = screen.getByLabelText('Reason')

        await user.selectOptions(select, 'harassment')

        const textarea = screen.getByLabelText('Additional Details')
        await user.type(textarea, 'Report reason here.')
        await user.click(screen.getByRole('button', { name: 'Submit Report' }))

        expect(api.post).toHaveBeenCalledWith(
            '/report',
            expect.objectContaining({
                category: 'harassment'
            }),
            undefined,
            expect.any(String)
        )
    })

    it('handles api error', async () => {
        const error = new Error('API Error')
        vi.mocked(api.post).mockRejectedValueOnce(error)

        const { user } = renderModal()
        const textarea = screen.getByLabelText('Additional Details')
        await user.type(textarea, 'This is a valid report reason.')
        await user.click(screen.getByRole('button', { name: 'Submit Report' }))

        expect(api.post).toHaveBeenCalled()
        expect(mockHandleError).toHaveBeenCalledWith(error, expect.any(String), expect.any(Object))
        // Should NOT close
        expect(defaultProps.onClose).not.toHaveBeenCalled()
    })

    it('resets state when closed and reopened', async () => {
        const { rerender } = render(<ReportContentModal {...defaultProps} />, { wrapper: createTestWrapper().wrapper })

        const textarea = screen.getByLabelText('Additional Details')
        fireEvent.change(textarea, { target: { value: 'Dirty state' } })

        // Close
        rerender(<ReportContentModal {...defaultProps} isOpen={false} />)

        // Reopen
        rerender(<ReportContentModal {...defaultProps} isOpen={true} />)

        // Checks
        expect(screen.getByLabelText('Additional Details')).toHaveValue('')
    })
})
