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

export function DropdownMenu({ children }: Readonly<DropdownMenuProps>) {
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

export function DropdownMenuTrigger({ asChild, children }: Readonly<DropdownMenuTriggerProps>) {
    const context = React.useContext(DropdownContext)
    if (!context) { throw new Error('DropdownMenuTrigger must be used within a DropdownMenu') }

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        context.setIsOpen(!context.isOpen)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            context.setIsOpen(!context.isOpen)
        }
    }

    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement<{ onClick?: React.MouseEventHandler; onKeyDown?: React.KeyboardEventHandler; 'aria-expanded'?: boolean; 'aria-haspopup'?: boolean }>, {
            onClick: handleClick,
            onKeyDown: handleKeyDown,
            'aria-expanded': context.isOpen,
            'aria-haspopup': true,
        })
    }

    return (
        <button
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            aria-expanded={context.isOpen}
            aria-haspopup={true}
            type="button">
            {children}
        </button>
    )
}

function DropdownMenuContentInner({ className, align = 'center', children }: Readonly<DropdownMenuContentProps>) {
    const context = React.useContext(DropdownContext)
    const contentRef = useRef<HTMLDivElement>(null)
    const [focusedIndex, setFocusedIndex] = useState(0)

    if (!context) { throw new Error('DropdownMenuContentInner must be used within a DropdownMenu') }

    const focusedIndexRef = useRef(focusedIndex)

    // Sync ref with state
    useEffect(() => {
        focusedIndexRef.current = focusedIndex
    }, [focusedIndex])

    // Handle keyboard navigation within menu
    useEffect(() => {
        if (!contentRef.current) { return }

        const getMenuItems = () => {
            return Array.from(contentRef.current?.querySelectorAll('[role="menuitem"]') || []) as HTMLElement[]
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            const items = getMenuItems()
            if (!items.length) { return }

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault()
                    setFocusedIndex(prev => (prev + 1) % items.length)
                    break
                case 'ArrowUp':
                    e.preventDefault()
                    setFocusedIndex(prev => (prev - 1 + items.length) % items.length)
                    break
                case 'Home':
                    e.preventDefault()
                    setFocusedIndex(0)
                    break
                case 'End':
                    e.preventDefault()
                    setFocusedIndex(items.length - 1)
                    break
                case 'Enter':
                case ' ':
                    // Trigger click on focused item if input is active
                    e.preventDefault()
                    // Use ref to get current value without breaking effect stability
                    if (focusedIndexRef.current >= 0 && items[focusedIndexRef.current]) {
                        items[focusedIndexRef.current].click()
                    }
                    break
                default:
                    break
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    // Focus element when focusedIndex changes
    useEffect(() => {
        if (!contentRef.current) { return }
        const items = Array.from(contentRef.current?.querySelectorAll('[role="menuitem"]') || []) as HTMLElement[]
        if (focusedIndex >= 0 && items[focusedIndex]) {
            items[focusedIndex].focus()
        }
    }, [focusedIndex])

    const alignmentClasses = {
        start: 'left-0',
        end: 'right-0',
        center: 'left-1/2 -translate-x-1/2',
    }

    return (
        <div
            ref={contentRef}
            className={cn(
                'absolute z-50 mt-2 min-w-[12rem] overflow-hidden rounded-xl border border-border-default bg-background-primary p-1 text-text-primary shadow-lg animate-in fade-in-80 zoom-in-95',
                alignmentClasses[align],
                className
            )}
            role="menu"
        >
            {children}
        </div>
    )
}

export function DropdownMenuContent(props: Readonly<DropdownMenuContentProps>) {
    const context = React.useContext(DropdownContext)
    if (!context) { throw new Error('DropdownMenuContent must be used within a DropdownMenu') }

    if (!context.isOpen) { return null }

    return <DropdownMenuContentInner {...props} />
}

export function DropdownMenuItem({ asChild, children, className, onClick }: Readonly<DropdownMenuItemProps>) {
    const context = React.useContext(DropdownContext)

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        // Only prevent default if not a child (e.g. Link)
        // If it is a child, we let the child handle the click (navigation)
        if (!asChild) {
            e.preventDefault()
        }
        onClick?.()
        context?.setIsOpen(false)
    }

    // Also handle KeyDown locally if needed, but parent handles delegation mostly.
    // However, for accessibility, we should enable standard keyboard interaction on the item itself if focused.
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            onClick?.()
            context?.setIsOpen(false)
        }
    }

    const baseClasses = cn(
        'relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm outline-none transition-colors hover:bg-background-secondary focus:bg-background-secondary focus:outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
    )

    if (asChild && React.isValidElement(children)) {
        const child = children as React.ReactElement<{ className?: string; onClick?: (e: React.MouseEvent) => void; onKeyDown?: (e: React.KeyboardEvent) => void; role?: string; tabIndex?: number }>
        return React.cloneElement(child, {
            className: cn(baseClasses, child.props.className),
            onClick: (e: React.MouseEvent) => {
                handleClick(e)
                child.props.onClick?.(e)
            },
            onKeyDown: (e: React.KeyboardEvent) => {
                handleKeyDown(e)
                child.props.onKeyDown?.(e)
            },
            role: 'menuitem',
            tabIndex: -1 // Manage focus via roving index manually or rely on focus() calls
        })
    }

    return (
        <div
            className={baseClasses}
            onClick={handleClick}
            role="menuitem"
            tabIndex={-1} // Manage focus via roving index manually or rely on focus() calls
            onKeyDown={handleKeyDown}
        >
            {children}
        </div>
    )
}
