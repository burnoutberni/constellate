import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'

<<<<<<< HEAD
import { Button, CloseIcon } from '@/components/ui'
import { getNavLinks } from '@/lib/navigation'
=======
import { Button } from '@/components/ui'
>>>>>>> b821aaf (WP-120: Navigation Redesign)
import { cn } from '@/lib/utils'

export interface MobileNavProps {
	isOpen: boolean
	onClose: () => void
	user?: {
		id: string
		name?: string
		email?: string
		username?: string
	} | null
	isAdmin?: boolean
}

/**
 * MobileNav component - slide-out navigation menu for mobile devices.
 * Fully accessible with keyboard navigation, focus trap, and ARIA support.
 */
<<<<<<< HEAD
export function MobileNav({ isOpen, onClose, user, isAdmin = false }: MobileNavProps) {
=======
export function MobileNav({
	isOpen,
	onClose,
	user,
	isAdmin = false,
}: MobileNavProps) {
>>>>>>> b821aaf (WP-120: Navigation Redesign)
	const navRef = useRef<HTMLElement>(null)
	const location = useLocation()

	// Close on route change
	useEffect(() => {
		onClose()
	}, [location.pathname, onClose])

	// Focus trap and keyboard handling
	useEffect(() => {
		if (!isOpen) {
			return undefined
		}

		const nav = navRef.current
		if (!nav) {
			return undefined
		}

		// Focus first focusable element
		if (nav) {
<<<<<<< HEAD
			const firstFocusable = nav.querySelector<HTMLElement>('a[href], button:not([disabled])')
=======
			const firstFocusable = nav.querySelector<HTMLElement>(
				'a[href], button:not([disabled])'
			)
>>>>>>> b821aaf (WP-120: Navigation Redesign)
			firstFocusable?.focus()
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				onClose()
				return
			}

			// Focus trap
			if (event.key === 'Tab' && nav) {
				const focusableElements = nav.querySelectorAll<HTMLElement>(
					'a[href], button:not([disabled])'
				)
				const focusableArray = Array.from(focusableElements)
<<<<<<< HEAD
				const currentIndex = focusableArray.findIndex((el) => el === document.activeElement)
=======
				const currentIndex = focusableArray.findIndex(
					(el) => el === document.activeElement
				)
>>>>>>> b821aaf (WP-120: Navigation Redesign)

				if (event.shiftKey) {
					// Shift + Tab
					if (currentIndex === 0) {
						event.preventDefault()
						focusableArray[focusableArray.length - 1]?.focus()
					}
				} else {
					// Tab
					if (currentIndex === focusableArray.length - 1) {
						event.preventDefault()
						focusableArray[0]?.focus()
					}
				}
			}
		}

		// Prevent body scroll when menu is open
		document.body.style.overflow = 'hidden'

		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('keydown', handleKeyDown)
			document.body.style.overflow = ''
		}
	}, [isOpen, onClose])

	// Close on outside click
	useEffect(() => {
		if (!isOpen) {
			return undefined
		}

		function handleClickOutside(event: MouseEvent) {
			if (navRef.current && !navRef.current.contains(event.target as Node)) {
				onClose()
			}
		}

		// Delay to avoid immediate close on open
		const timeout = setTimeout(() => {
			document.addEventListener('mousedown', handleClickOutside)
		}, 100)

		return () => {
			clearTimeout(timeout)
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [isOpen, onClose])

<<<<<<< HEAD
	const navLinks = getNavLinks(Boolean(user))

	// Get user-specific navigation links
	const getUserLinks = (): Array<{ to: string; label: string }> => {
		if (!user) {
			return []
		}
		return [
			{ to: `/@${user.username || user.id}`, label: 'My Profile' },
			{ to: '/settings', label: 'Settings' },
			{ to: '/reminders', label: 'Reminders' },
			{ to: '/followers/pending', label: 'Followers' },
			...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
		]
	}

	const userLinks = getUserLinks()

	// Shared className logic for navigation links
	const getLinkClassName = (isActive: boolean) =>
		cn(
			'block px-4 py-3 rounded-lg text-base font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
			isActive
				? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
				: 'text-text-secondary hover:bg-background-secondary hover:text-text-primary'
		)
=======
	const navLinks = [
		{ to: '/feed', label: 'Feed' },
		{ to: '/calendar', label: 'Calendar' },
		{ to: '/search', label: 'Search' },
		...(user
			? [
					{ to: '/templates', label: 'Templates' },
					{ to: '/instances', label: 'Instances' },
				]
			: []),
		{ to: '/about', label: 'About' },
	]
>>>>>>> b821aaf (WP-120: Navigation Redesign)

	return (
		<>
			{/* Backdrop */}
			{isOpen && (
				<div
					className="fixed inset-0 bg-background-primary/80 backdrop-blur-sm z-40 transition-opacity"
					aria-hidden="true"
					onClick={onClose}
				/>
			)}

			{/* Navigation Menu */}
			<nav
				ref={navRef}
				className={cn(
					'fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-background-primary border-l border-border-default z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto',
					isOpen ? 'translate-x-0' : 'translate-x-full'
				)}
				aria-label="Mobile navigation"
				aria-hidden={!isOpen}>
				<div className="flex flex-col h-full">
					{/* Header */}
					<div className="flex items-center justify-between p-4 border-b border-border-default">
						<h2 className="text-lg font-semibold text-text-primary">Menu</h2>
						<Button
							variant="ghost"
							size="sm"
							onClick={onClose}
							aria-label="Close menu"
							className="rounded-full p-2">
<<<<<<< HEAD
							<CloseIcon className="w-5 h-5" />
=======
							<svg
								className="w-5 h-5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								aria-hidden="true">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
>>>>>>> b821aaf (WP-120: Navigation Redesign)
						</Button>
					</div>

					{/* Navigation Links */}
					<div className="flex-1 p-4">
						<ul className="space-y-1" role="list">
							{navLinks.map((link) => {
								const isActive = location.pathname === link.to
								return (
									<li key={link.to}>
<<<<<<< HEAD
										<Link to={link.to} className={getLinkClassName(isActive)}>
=======
										<Link
											to={link.to}
											onClick={onClose}
											className={cn(
												'block px-4 py-3 rounded-lg text-base font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
												isActive
													? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
													: 'text-text-secondary hover:bg-background-secondary hover:text-text-primary'
											)}>
>>>>>>> b821aaf (WP-120: Navigation Redesign)
											{link.label}
										</Link>
									</li>
								)
							})}
						</ul>

						{/* User-specific links */}
<<<<<<< HEAD
						{userLinks.length > 0 && (
							<>
								<div className="border-t border-border-default my-4" />
								<ul className="space-y-1" role="list">
									{userLinks.map((link) => {
										const isActive = location.pathname === link.to
										return (
											<li key={link.to}>
												<Link
													to={link.to}
													className={getLinkClassName(isActive)}>
													{link.label}
												</Link>
											</li>
										)
									})}
=======
						{user && (
							<>
								<div className="border-t border-border-default my-4" />
								<ul className="space-y-1" role="list">
									<li>
										<Link
											to={`/@${user.username || user.id}`}
											onClick={onClose}
											className={cn(
												'block px-4 py-3 rounded-lg text-base font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
												location.pathname === `/@${user.username || user.id}`
													? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
													: 'text-text-secondary hover:bg-background-secondary hover:text-text-primary'
											)}>
											My Profile
										</Link>
									</li>
									<li>
										<Link
											to="/settings"
											onClick={onClose}
											className={cn(
												'block px-4 py-3 rounded-lg text-base font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
												location.pathname === '/settings'
													? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
													: 'text-text-secondary hover:bg-background-secondary hover:text-text-primary'
											)}>
											Settings
										</Link>
									</li>
									<li>
										<Link
											to="/reminders"
											onClick={onClose}
											className={cn(
												'block px-4 py-3 rounded-lg text-base font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
												location.pathname === '/reminders'
													? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
													: 'text-text-secondary hover:bg-background-secondary hover:text-text-primary'
											)}>
											Reminders
										</Link>
									</li>
									<li>
										<Link
											to="/followers/pending"
											onClick={onClose}
											className={cn(
												'block px-4 py-3 rounded-lg text-base font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
												location.pathname === '/followers/pending'
													? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
													: 'text-text-secondary hover:bg-background-secondary hover:text-text-primary'
											)}>
											Followers
										</Link>
									</li>
									{isAdmin && (
										<li>
											<Link
												to="/admin"
												onClick={onClose}
												className={cn(
													'block px-4 py-3 rounded-lg text-base font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
													location.pathname === '/admin'
														? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
														: 'text-text-secondary hover:bg-background-secondary hover:text-text-primary'
												)}>
												Admin
											</Link>
										</li>
									)}
>>>>>>> b821aaf (WP-120: Navigation Redesign)
								</ul>
							</>
						)}
					</div>
				</div>
			</nav>
		</>
	)
}
<<<<<<< HEAD
=======

>>>>>>> b821aaf (WP-120: Navigation Redesign)
