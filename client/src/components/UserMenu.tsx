import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { Avatar, Button, Card, CardContent } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface UserMenuProps {
	user: {
		id: string
		name?: string
		email?: string
		username?: string
		image?: string | null
	}
	isAdmin?: boolean
	onLogout?: () => void
}

/**
 * UserMenu component - dropdown menu for user actions.
 * Fully accessible with keyboard navigation and ARIA support.
 */
export function UserMenu({ user, isAdmin = false, onLogout }: UserMenuProps) {
	const [isOpen, setIsOpen] = useState(false)
	const menuRef = useRef<HTMLDivElement>(null)
	const buttonRef = useRef<HTMLButtonElement>(null)

	// Close menu when clicking outside
	useEffect(() => {
		if (!isOpen) {
			return undefined
		}

		function handleClickOutside(event: MouseEvent) {
			if (
				menuRef.current &&
				!menuRef.current.contains(event.target as Node) &&
				buttonRef.current &&
				!buttonRef.current.contains(event.target as Node)
			) {
				setIsOpen(false)
			}
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				setIsOpen(false)
				buttonRef.current?.focus()
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [isOpen])

	// Keyboard navigation within menu
	useEffect(() => {
		if (!isOpen) {
			return undefined
		}

		function handleKeyDown(event: KeyboardEvent) {
			const menu = menuRef.current
			if (!menu) {
				return
			}

			const focusableElements = menu.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled])'
			)
			const focusableArray = Array.from(focusableElements)
			const currentIndex = focusableArray.findIndex((el) => el === document.activeElement)

			switch (event.key) {
				case 'ArrowDown':
					event.preventDefault()
					if (currentIndex < focusableArray.length - 1) {
						focusableArray[currentIndex + 1]?.focus()
					} else {
						focusableArray[0]?.focus()
					}
					break
				case 'ArrowUp':
					event.preventDefault()
					if (currentIndex > 0) {
						focusableArray[currentIndex - 1]?.focus()
					} else {
						focusableArray[focusableArray.length - 1]?.focus()
					}
					break
				case 'Home':
					event.preventDefault()
					focusableArray[0]?.focus()
					break
				case 'End':
					event.preventDefault()
					focusableArray[focusableArray.length - 1]?.focus()
					break
				default:
					// Other keys are ignored
					break
			}
		}

		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [isOpen])

	const handleLogout = () => {
		setIsOpen(false)
		if (onLogout) {
			onLogout()
		}
	}

	const handleLinkClick = () => {
		setIsOpen(false)
	}

	const displayName = user.name || user.username || user.email || 'User'
	const initials = displayName
		.split(' ')
		.map((n) => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2)

	return (
		<div className="relative">
			<Button
				ref={buttonRef}
				type="button"
				variant="ghost"
				size="sm"
				onClick={() => setIsOpen(!isOpen)}
				aria-label="User menu"
				aria-expanded={isOpen}
				aria-haspopup="menu"
				className="flex items-center gap-2 rounded-full p-1.5 hover:bg-background-secondary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500">
				<Avatar
					src={user.image || undefined}
					alt={displayName}
					fallback={initials}
					size="sm"
				/>
				<span className="hidden md:inline text-sm font-medium text-text-primary">
					{displayName}
				</span>
				<svg
					className={cn(
						'w-4 h-4 text-text-secondary transition-transform',
						isOpen && 'rotate-180'
					)}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true">
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M19 9l-7 7-7-7"
					/>
				</svg>
			</Button>

			{isOpen && (
				<Card
					ref={menuRef}
					variant="elevated"
					padding="none"
					className="absolute right-0 mt-2 w-56 z-50"
					role="menu"
					aria-labelledby="user-menu-button">
					<CardContent className="p-2">
						<div className="px-3 py-2 border-b border-border-default mb-2">
							<p className="text-sm font-semibold text-text-primary">{displayName}</p>
							{user.email && (
								<p className="text-xs text-text-tertiary truncate">{user.email}</p>
							)}
						</div>

						<nav className="flex flex-col gap-1">
							<Link
								to={`/@${user.username || user.id}`}
								onClick={handleLinkClick}
								className="px-3 py-2 text-sm text-text-secondary hover:bg-background-secondary rounded transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
								role="menuitem">
								View Profile
							</Link>
							<Link
								to="/settings"
								onClick={handleLinkClick}
								className="px-3 py-2 text-sm text-text-secondary hover:bg-background-secondary rounded transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
								role="menuitem">
								Settings
							</Link>
							<Link
								to="/reminders"
								onClick={handleLinkClick}
								className="px-3 py-2 text-sm text-text-secondary hover:bg-background-secondary rounded transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
								role="menuitem">
								Reminders
							</Link>
							<Link
								to="/followers/pending"
								onClick={handleLinkClick}
								className="px-3 py-2 text-sm text-text-secondary hover:bg-background-secondary rounded transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
								role="menuitem">
								Followers
							</Link>
							{isAdmin && (
								<Link
									to="/admin"
									onClick={handleLinkClick}
									className="px-3 py-2 text-sm text-text-secondary hover:bg-background-secondary rounded transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
									role="menuitem">
									Admin
								</Link>
							)}
							<div className="border-t border-border-default my-1" />
							<button
								type="button"
								onClick={handleLogout}
								className="px-3 py-2 text-sm text-error-600 hover:bg-error-50 rounded transition-colors text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error-500"
								role="menuitem">
								Logout
							</button>
						</nav>
					</CardContent>
				</Card>
			)}
		</div>
	)
}

