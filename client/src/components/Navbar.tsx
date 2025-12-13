import { useQuery } from '@tanstack/react-query'
<<<<<<< HEAD
import { useCallback, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { queryKeys } from '@/hooks/queries'
import { api } from '@/lib/api-client'
import { getNavLinks, shouldShowBreadcrumbs } from '@/lib/navigation'
=======
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { queryKeys } from '@/hooks/queries'
import { api } from '@/lib/api-client'
>>>>>>> b821aaf (WP-120: Navigation Redesign)
import { cn } from '@/lib/utils'
import type { UserProfile } from '@/types'

import { Breadcrumbs } from './Breadcrumbs'
import { MobileNav } from './MobileNav'
import { NotificationBell } from './NotificationBell'
import { SearchBar } from './SearchBar'
import { ThemeToggle } from './ThemeToggle'
<<<<<<< HEAD
import { Button, MenuIcon, SearchIcon } from './ui'
import { UserMenu } from './UserMenu'

type AuthenticatedUser = {
	name?: string
	email?: string
	id: string
	username?: string
	image?: string | null
}
=======
import { Button } from './ui'
import { UserMenu } from './UserMenu'
>>>>>>> b821aaf (WP-120: Navigation Redesign)

export function Navbar({
	isConnected,
	user,
	onLogout,
}: {
	isConnected?: boolean
<<<<<<< HEAD
	user?: AuthenticatedUser | null
=======
	user?: { name?: string; email?: string; id?: string; username?: string; image?: string | null } | null
>>>>>>> b821aaf (WP-120: Navigation Redesign)
	onLogout?: () => void
}) {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
	const location = useLocation()
<<<<<<< HEAD
	const navigate = useNavigate()
=======
>>>>>>> b821aaf (WP-120: Navigation Redesign)

	// Check if current user is admin
	const { data: currentUserProfile } = useQuery<UserProfile | null>({
		queryKey: queryKeys.users.currentProfile(user?.id),
		queryFn: async () => {
			if (!user?.id) {
				return null
			}
			try {
				return await api.get<UserProfile>(
					'/users/me/profile',
					undefined,
					undefined,
					'Failed to fetch profile'
				)
			} catch {
				return null
			}
		},
		enabled: Boolean(user?.id),
	})

	const isAdmin = currentUserProfile?.isAdmin || false

<<<<<<< HEAD
	// Memoize the mobile menu close handler to prevent unnecessary re-renders
	const handleCloseMobileMenu = useCallback(() => {
		setMobileMenuOpen(false)
	}, [])

	// Navigation links
	const navLinks = getNavLinks(Boolean(user))

	/**
	 * Top-level paths where breadcrumbs are hidden.
	 * These are pages directly accessible from the main navigation, so showing
	 * breadcrumbs like "Home / Feed" would be redundant. Breadcrumbs are only
	 * shown on deeper pages (profiles, event details, nested routes) where they
	 * provide valuable navigation context.
	 */
	const topLevelPaths = ['/', ...navLinks.map((link) => link.to)]

	// Determine if breadcrumbs should be shown for the current route
	const showBreadcrumbs = shouldShowBreadcrumbs(location.pathname, topLevelPaths)
=======
	// Navigation links
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
			<nav
				className="bg-background-primary border-b border-border-default sticky top-0 z-30 backdrop-blur-sm bg-opacity-95"
				aria-label="Main navigation">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex items-center justify-between h-16">
						{/* Left section: Logo and Desktop Navigation */}
						<div className="flex items-center gap-4 lg:gap-8 flex-1 min-w-0">
							{/* Mobile menu button */}
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setMobileMenuOpen(true)}
								aria-label="Open mobile menu"
								aria-expanded={mobileMenuOpen}
								className="md:hidden rounded-lg p-2">
<<<<<<< HEAD
								<MenuIcon className="w-6 h-6" />
=======
								<svg
									className="w-6 h-6"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									aria-hidden="true">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M4 6h16M4 12h16M4 18h16"
									/>
								</svg>
>>>>>>> b821aaf (WP-120: Navigation Redesign)
							</Button>

							{/* Logo */}
							<Link
								to={user ? '/feed' : '/'}
								className="text-xl sm:text-2xl font-bold text-primary-600 hover:text-primary-700 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 rounded flex-shrink-0">
								Constellate
							</Link>

							{/* Desktop Navigation Links */}
<<<<<<< HEAD
							<nav
								className="hidden md:flex items-center gap-1"
								aria-label="Desktop navigation">
=======
							<nav className="hidden md:flex items-center gap-1" aria-label="Desktop navigation">
>>>>>>> b821aaf (WP-120: Navigation Redesign)
								{navLinks.map((link) => {
									const isActive = location.pathname === link.to
									return (
										<Link
											key={link.to}
											to={link.to}
											className={cn(
												'px-3 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
												isActive
													? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
													: 'text-text-secondary hover:bg-background-secondary hover:text-text-primary'
											)}
											aria-current={isActive ? 'page' : undefined}>
											{link.label}
										</Link>
									)
								})}
							</nav>
						</div>

						{/* Center section: Search Bar (Desktop) */}
						<div className="hidden lg:block flex-1 max-w-md mx-8">
							<SearchBar />
						</div>

						{/* Right section: Actions */}
						<div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
							{/* Search button for mobile/tablet */}
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									// Navigate to search page on mobile
<<<<<<< HEAD
									navigate('/search')
								}}
								aria-label="Search"
								className="lg:hidden rounded-lg p-2">
								<SearchIcon className="w-5 h-5" />
=======
									window.location.href = '/search'
								}}
								aria-label="Search"
								className="lg:hidden rounded-lg p-2">
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
										d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
									/>
								</svg>
>>>>>>> b821aaf (WP-120: Navigation Redesign)
							</Button>

							<ThemeToggle />

							{user ? (
								<>
									<NotificationBell userId={user.id} />
<<<<<<< HEAD
									<UserMenu user={user} isAdmin={isAdmin} onLogout={onLogout} />
								</>
							) : (
								<Link to="/login">
									<Button
										variant="primary"
										size="sm"
										className="whitespace-nowrap">
=======
									{user.id && (
										<UserMenu
											user={{
												id: user.id,
												name: user.name,
												email: user.email,
												username: user.username,
												image: user.image,
											}}
											isAdmin={isAdmin}
											onLogout={onLogout}
										/>
									)}
								</>
							) : (
								<Link to="/login">
									<Button variant="primary" size="sm" className="whitespace-nowrap">
>>>>>>> b821aaf (WP-120: Navigation Redesign)
										Sign In
									</Button>
								</Link>
							)}

							{/* Connection status indicator */}
							{isConnected && (
								<div
									className="hidden sm:flex items-center gap-2 text-xs text-success-600"
									aria-label="Live connection status">
									<div className="w-2 h-2 bg-success-600 rounded-full animate-pulse" />
									<span>Live</span>
								</div>
							)}
						</div>
					</div>

<<<<<<< HEAD
					{/* Breadcrumbs: Shown on deeper pages, hidden on top-level nav pages */}
					{showBreadcrumbs && (
						<div className="hidden md:block pb-3">
							<Breadcrumbs />
						</div>
					)}
=======
					{/* Breadcrumbs (Desktop only, shown on deeper pages) */}
					{location.pathname !== '/' &&
						location.pathname !== '/feed' &&
						location.pathname !== '/calendar' &&
						location.pathname !== '/search' && (
							<div className="hidden md:block pb-3">
								<Breadcrumbs />
							</div>
						)}
>>>>>>> b821aaf (WP-120: Navigation Redesign)
				</div>
			</nav>

			{/* Mobile Navigation Menu */}
			<MobileNav
				isOpen={mobileMenuOpen}
<<<<<<< HEAD
				onClose={handleCloseMobileMenu}
				user={user}
=======
				onClose={() => setMobileMenuOpen(false)}
				user={user ? { id: user.id || '', name: user.name, email: user.email, username: user.username } : null}
>>>>>>> b821aaf (WP-120: Navigation Redesign)
				isAdmin={isAdmin}
			/>
		</>
	)
}
