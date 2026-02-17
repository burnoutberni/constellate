import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '../../components/ui'

describe('Badge Coverage', () => {
    it('should render all variants', () => {
        const variants = [
            'default',
            'primary',
            'secondary',
            'success',
            'warning',
            'error',
            'info',
            'outline',
        ] as const

        variants.forEach((variant) => {
            const { unmount } = render(
                <Badge variant={variant} data-testid={`badge-${variant}`}>
                    {variant}
                </Badge>
            )
            const badge = screen.getByTestId(`badge-${variant}`)
            expect(badge).toBeInTheDocument()
            unmount()
        })
    })

    it('should render all sizes', () => {
        const sizes = ['sm', 'md', 'lg'] as const

        sizes.forEach((size) => {
            const { unmount } = render(
                <Badge size={size} data-testid={`badge-${size}`}>
                    {size}
                </Badge>
            )
            const badge = screen.getByTestId(`badge-${size}`)
            expect(badge).toBeInTheDocument()
            unmount()
        })
    })

    it('should render rounded pill by default', () => {
        render(<Badge data-testid="badge-rounded">Rounded</Badge>)
        const badge = screen.getByTestId('badge-rounded')
        expect(badge).toHaveClass('rounded-full')
    })

    it('should render square corners when rounded is false', () => {
        render(<Badge rounded={false} data-testid="badge-square">Square</Badge>)
        const badge = screen.getByTestId('badge-square')
        expect(badge).toHaveClass('rounded-md')
        expect(badge).not.toHaveClass('rounded-full')
    })
})
