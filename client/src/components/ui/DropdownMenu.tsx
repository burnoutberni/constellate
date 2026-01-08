import React, { useState, useRef, useEffect } from 'react'

import { cn } from '@/lib/utils'

interface DropdownMenuProps {
    children: React.ReactNode
}

interface DropdownMenuTriggerProps {
    asChild?: boolean
    children: React.ReactNode
}

interface DropdownMenuContentProps {
    className?: string
    align?: 'start' | 'end' | 'center'
    children: React.ReactNode
}

interface DropdownMenuItemProps {
    asChild?: boolean
    children: React.ReactNode
    className?: string
    onClick?: () => void
}

// Context to manage state
const DropdownContext = React.createContext<{
    isOpen: boolean
    setIsOpen: (open: boolean) => void
} | null>(null)

export function DropdownMenu({ children }: DropdownMenuProps) {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Handle Escape key
    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (isOpen && event.key === 'Escape') {
                setIsOpen(false)
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen])

    return (
        <DropdownContext.Provider value={{ isOpen, setIsOpen }}>
            <div ref={dropdownRef} className="relative inline-block text-left">
                {children}
            </div>
        </DropdownContext.Provider>
    )
}

export function DropdownMenuTrigger({ asChild, children }: DropdownMenuTriggerProps) {
    const context = React.useContext(DropdownContext)
    if (!context) { throw new Error('DropdownMenuTrigger must be used within a DropdownMenu') }

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        context.setIsOpen(!context.isOpen)
    }

    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement<{ onClick?: React.MouseEventHandler; 'aria-expanded'?: boolean; 'aria-haspopup'?: boolean }>, {
            onClick: handleClick,
            'aria-expanded': context.isOpen,
            'aria-haspopup': true,
        })
    }

    return (
        <button
            onClick={handleClick}
            aria-expanded={context.isOpen}
            aria-haspopup={true}
            type="button">
            {children}
        </button>
    )
}

export function DropdownMenuContent({ className, align = 'center', children }: DropdownMenuContentProps) {
    const context = React.useContext(DropdownContext)
    if (!context) { throw new Error('DropdownMenuContent must be used within a DropdownMenu') }

    if (!context.isOpen) { return null }

    const alignmentClasses = {
        start: 'left-0',
        end: 'right-0',
        center: 'left-1/2 -translate-x-1/2',
    }

    return (
        <div
            className={cn(
                'absolute z-50 mt-2 min-w-[12rem] overflow-hidden rounded-xl border border-border-default bg-background-primary p-1 text-text-primary shadow-lg animate-in fade-in-80 zoom-in-95',
                alignmentClasses[align],
                className
            )}>
            {children}
        </div>
    )
}

export function DropdownMenuItem({ asChild, children, className, onClick }: DropdownMenuItemProps) {
    const context = React.useContext(DropdownContext)

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        onClick?.()
        context?.setIsOpen(false)
    }

    const baseClasses = cn(
        'relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm outline-none transition-colors hover:bg-background-secondary focus:bg-background-secondary data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
    )

    if (asChild && React.isValidElement(children)) {
        const child = children as React.ReactElement<{ className?: string; onClick?: (e: React.MouseEvent) => void }>
        return React.cloneElement(child, {
            className: cn(baseClasses, child.props.className),
            onClick: (e: React.MouseEvent) => {
                handleClick(e)
                child.props.onClick?.(e)
            }
        })
    }

    return (
        <div className={baseClasses} onClick={handleClick}>
            {children}
        </div>
    )
}
