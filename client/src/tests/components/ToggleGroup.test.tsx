import React, { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ToggleGroup, ToggleButton } from '../../components/ui/ToggleGroup'
import userEvent from '@testing-library/user-event'
import { createTestWrapper } from '../testUtils'

describe('ToggleGroup Component', () => {
    it('should render children', () => {
        render(
            <ToggleGroup value="option1" onValueChange={() => {}}>
                <ToggleButton value="option1">Option 1</ToggleButton>
                <ToggleButton value="option2">Option 2</ToggleButton>
            </ToggleGroup>
        )
        expect(screen.getByText('Option 1')).toBeInTheDocument()
        expect(screen.getByText('Option 2')).toBeInTheDocument()
    })

    it('should handle value changes', async () => {
        const handleValueChange = vi.fn()
        render(
            <ToggleGroup value="option1" onValueChange={handleValueChange}>
                <ToggleButton value="option1">Option 1</ToggleButton>
                <ToggleButton value="option2">Option 2</ToggleButton>
            </ToggleGroup>
        )

        await userEvent.click(screen.getByText('Option 2'))
        expect(handleValueChange).toHaveBeenCalledWith('option2')
    })

    it('should highlight selected option', () => {
        render(
            <ToggleGroup value="option1" onValueChange={() => {}}>
                <ToggleButton value="option1">Option 1</ToggleButton>
                <ToggleButton value="option2">Option 2</ToggleButton>
            </ToggleGroup>
        )

        const option1 = screen.getByText('Option 1').closest('button')
        const option2 = screen.getByText('Option 2').closest('button')

        expect(option1).toHaveAttribute('aria-pressed', 'true')
        expect(option2).toHaveAttribute('aria-pressed', 'false')
    })

    it('should render icons correctly', () => {
        const Icon = () => <span data-testid="test-icon">icon</span>
        render(
            <ToggleGroup value="option1" onValueChange={() => {}}>
                <ToggleButton value="option1" icon={<Icon />}>Option 1</ToggleButton>
            </ToggleGroup>
        )

        expect(screen.getByTestId('test-icon')).toBeInTheDocument()
    })

    it('should throw error if ToggleButton is used outside ToggleGroup', () => {
        // Suppress console.error for this specific test as React will log an error about the boundary
        const originalError = console.error
        console.error = vi.fn()

        expect(() => {
            render(<ToggleButton value="test">Test</ToggleButton>)
        }).toThrow('ToggleButton must be used within a ToggleGroup')

        console.error = originalError
    })
})
