import React, { useState, useRef, useEffect } from 'react'

import { useRSVP } from '@/hooks/queries'
import { cn } from '@/lib/utils'

import { Button } from './ui'
import { AddIcon, CheckIcon, QuestionIcon, CloseIcon } from './ui/icons'

interface RSVPButtonProps {
    eventId: string
    currentStatus?: 'attending' | 'maybe' | 'not_attending' | null
    className?: string
    size?: 'sm' | 'md' | 'lg'
    onSignUp?: () => void
    isAuthenticated?: boolean
    onOpenChange?: (isOpen: boolean) => void
    variant?: 'default' | 'icon'
}

export function RSVPButton({ eventId, currentStatus, className, size = 'sm', onSignUp, isAuthenticated = true, onOpenChange, variant = 'default' }: RSVPButtonProps) {
    const [isOpen, setIsOpen] = useState(false)
    const { mutate: rsvp, isPending } = useRSVP(eventId)
    const [isAnimating, setIsAnimating] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

    // Notify parent of open state change
    useEffect(() => {
        onOpenChange?.(isOpen)
    }, [isOpen, onOpenChange])

    // Close on click outside
    useEffect(() => {
        if (!isOpen) { return }
        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    // Close on Escape
    useEffect(() => {
        if (!isOpen) { return }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false)
                buttonRef.current?.focus()
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen])

    const handleRSVP = (status: 'attending' | 'maybe' | 'not_attending' | null) => {
        if (!isAuthenticated && onSignUp) {
            onSignUp()
            return
        }

        setIsAnimating(true)
        setTimeout(() => setIsAnimating(false), 300) // Reset animation state after duration

        // Always send explicit status (or null for removal)
        // If status is null, we pass it as is, useRSVP handles it (delete)
        if (status === null) {
            rsvp(null)
        } else {
            rsvp({ status })
        }
        setIsOpen(false)
    }

    // Declarative style configuration for each status
    const statusConfig = {
        attending: {
            label: 'Going',
            icon: <CheckIcon className="w-4 h-4" />,
            wrapperClass:
                'bg-primary-600 dark:bg-primary-600 text-white hover:bg-primary-700 dark:hover:bg-primary-500 border border-transparent shadow-md ring-0',
            separatorClass: 'border-l-white/20',
            buttonTextClass: 'text-white',
        },
        maybe: {
            label: 'Maybe',
            icon: <QuestionIcon className="w-4 h-4" />,
            wrapperClass:
                'bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 hover:bg-amber-200 dark:hover:bg-amber-900/50 shadow-sm',
            separatorClass: 'border-l-amber-300 dark:border-l-amber-700',
            buttonTextClass: 'text-amber-900 dark:text-amber-200',
        },
        not_attending: {
            label: 'Not Going',
            icon: <CloseIcon className="w-4 h-4" />,
            wrapperClass:
                'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700 shadow-sm',
            separatorClass: 'border-l-neutral-200 dark:border-l-neutral-700',
            buttonTextClass: 'text-neutral-600 dark:text-neutral-300',
        },
        default: {
            label: 'Going',
            icon: <AddIcon className="w-4 h-4" />,
            wrapperClass:
                'bg-transparent text-primary-600 dark:text-primary-400 border border-primary-600 dark:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/30 shadow-sm',
            separatorClass: 'border-l-primary-600 dark:border-l-primary-400',
            buttonTextClass: 'text-primary-600 dark:text-primary-400',
        },
    } as const

    // Get current configuration based on status
    const config = currentStatus ? statusConfig[currentStatus] : statusConfig.default
    const { label, icon, wrapperClass, separatorClass, buttonTextClass } = config

    const stopPropagation = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation()
        e.preventDefault()
    }

    // Helper to determine if we should remove or add attendance
    // If any status is set, clicking main button removes it (toggles off)
    // If no status, clicking sets to 'attending'
    const handleMainClick = (e: React.MouseEvent) => {
        stopPropagation(e)
        if (!isAuthenticated && onSignUp) {
            onSignUp()
            return
        }
        if (currentStatus) {
            handleRSVP(null)
        } else {
            handleRSVP('attending')
        }
    }

    return (
        <div
            className={cn("relative inline-block text-left", className, isOpen && "rsvp-open")}
            onClick={stopPropagation}
            onMouseDown={stopPropagation}
        >
            <div className={cn(
                "flex rounded-md transition-all duration-200 group",
                wrapperClass,
                variant === 'icon' && "w-auto" // Let widths animate in icon mode if needed
            )}>
                <Button
                    variant="ghost" // Use ghost as we handle outer styling
                    size={size}
                    leftIcon={icon ? (
                        <span className={cn("transition-transform duration-300 flex items-center justify-center", isAnimating && "scale-125")}>
                            {icon}
                        </span>
                    ) : undefined}
                    className={cn(
                        "rounded-r-none border-0 relative overflow-hidden transition-all duration-300 whitespace-nowrap",
                        // Reset ghost hover/text styles to inherit or match parent
                        "!bg-transparent !hover:bg-transparent !active:bg-transparent hover:text-current",
                        buttonTextClass,
                        isAnimating && "scale-105",
                        "focus:z-10 focus:ring-2 focus:ring-offset-1 focus:ring-primary-500 dark:focus:ring-offset-neutral-900",
                        // Icon variant transitions: hide text by default, show on hover
                        variant === 'icon' ? "w-8 pr-0 pl-2 group-hover:w-auto group-hover:pr-3" : ""
                    )}
                    onClick={handleMainClick}
                    onMouseDown={stopPropagation}
                    loading={isPending}
                    aria-label={currentStatus ? `Change RSVP status from ${label}` : "RSVP to event"}
                >
                    {variant === 'icon' ? (
                        <span className={cn(
                            "max-w-0 opacity-0 group-hover:max-w-[100px] group-hover:opacity-100 transition-all duration-300 ease-in-out overflow-hidden inline-block align-middle ml-0 group-hover:ml-2"
                        )}>
                            {label}
                        </span>
                    ) : (
                        label
                    )}
                </Button>
                <button
                    ref={buttonRef}
                    type="button"
                    className={cn(
                        "inline-flex items-center justify-center rounded-r-md px-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500 dark:focus:ring-offset-neutral-900 transition-all duration-200",
                        "min-h-full border-l border-y-0 border-r-0",
                        separatorClass,
                        "hover:bg-black/5 dark:hover:bg-white/10"
                    )}
                    onClick={(e: React.MouseEvent) => {
                        stopPropagation(e)
                        setIsOpen(!isOpen)
                    }}
                    onMouseDown={stopPropagation}
                    aria-haspopup="true"
                    aria-expanded={isOpen}
                    aria-controls="rsvp-menu"
                    aria-label="RSVP options"
                >
                    <span className="sr-only">Open options</span>
                    <svg
                        className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")}
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>

            {isOpen && (
                <div
                    ref={menuRef}
                    id="rsvp-menu"
                    className="absolute right-0 z-50 mt-2 w-44 origin-top-right rounded-lg bg-background-primary dark:bg-neutral-900 shadow-xl ring-1 ring-border-default dark:ring-neutral-700 focus:outline-none border border-border-default dark:border-neutral-700 animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="menu-button"
                    tabIndex={-1}
                    onMouseLeave={() => setIsOpen(false)}
                    onClick={stopPropagation}
                    onMouseDown={stopPropagation}
                >
                    <div className="p-1" role="none">
                        <button
                            className={cn(
                                "group flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors",
                                currentStatus === 'attending'
                                    ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium"
                                    : "text-text-primary hover:bg-background-secondary dark:hover:bg-neutral-800"
                            )}
                            role="menuitem"
                            onClick={(e: React.MouseEvent) => {
                                stopPropagation(e)
                                handleRSVP('attending')
                            }}
                            onMouseDown={stopPropagation}
                        >
                            <span className="mr-3 flex h-5 w-5 items-center justify-center text-lg text-primary-600 dark:text-primary-400">
                                <CheckIcon className="w-5 h-5" />
                            </span>
                            Going
                        </button>
                        <button
                            className={cn(
                                "group flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors",
                                currentStatus === 'maybe'
                                    ? "bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 font-medium"
                                    : "text-text-primary hover:bg-background-secondary dark:hover:bg-neutral-800"
                            )}
                            role="menuitem"
                            onClick={(e: React.MouseEvent) => {
                                stopPropagation(e)
                                handleRSVP('maybe')
                            }}
                            onMouseDown={stopPropagation}
                        >
                            <span className="mr-3 flex h-5 w-5 items-center justify-center text-lg text-amber-500 dark:text-amber-400">
                                <QuestionIcon className="w-5 h-5" />
                            </span>
                            Maybe
                        </button>
                        <button
                            className={cn(
                                "group flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors",
                                currentStatus === 'not_attending'
                                    ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium"
                                    : "text-text-primary hover:bg-background-secondary dark:hover:bg-neutral-800"
                            )}
                            role="menuitem"
                            onClick={(e: React.MouseEvent) => {
                                stopPropagation(e)
                                handleRSVP('not_attending')
                            }}
                            onMouseDown={stopPropagation}
                        >
                            <span className="mr-3 flex h-5 w-5 items-center justify-center text-lg text-neutral-500 dark:text-neutral-400">
                                <CloseIcon className="w-5 h-5" />
                            </span>
                            Not Going
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
