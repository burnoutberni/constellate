import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { queryKeys } from '@/hooks/queries'
import { api } from '@/lib/api-client'
import { getNavLinks, shouldShowBreadcrumbs } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import type { UserProfile } from '@/types'

import { Breadcrumbs } from './Breadcrumbs'
import { MobileNav } from './MobileNav'
import { NotificationBell } from './NotificationBell'
import { SearchBar } from './SearchBar'
import { ThemeToggle } from './ThemeToggle'
import { Button, MenuIcon, SearchIcon } from './ui'
import { UserMenu } from './UserMenu'

type AuthenticatedUser = {
	name?: string
	email?: string
	id: string
	username?: string
	image?: string | null
}

export function Navbar({
	isConnected,
	user,
	onLogout,
}: {
	isConnected?: boolean
	user?: AuthenticatedUser | null
	onLogout?: () => void
}) {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
	const location = useLocation()
	const navigate = useNavigate()

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
								<MenuIcon className="w-6 h-6" />
							</Button>

							{/* Logo */}
							<Link
								to={user ? '/feed' : '/'}
								className="text-xl sm:text-2xl font-bold text-primary-600 hover:text-primary-700 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 rounded flex-shrink-0">
								Constellate
							</Link>

							{/* Desktop Navigation Links */}
							<nav
								className="hidden md:flex items-center gap-1"
								aria-label="Desktop navigation">
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
									navigate('/search')
								}}
								aria-label="Search"
								className="lg:hidden rounded-lg p-2">
								<SearchIcon className="w-5 h-5" />
							</Button>

							<ThemeToggle />

							{user ? (
								<>
									<NotificationBell userId={user.id} />
									<UserMenu user={user} isAdmin={isAdmin} onLogout={onLogout} />
								</>
							) : (
								<Link to="/login">
									<Button
										variant="primary"
										size="sm"
										className="whitespace-nowrap">
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

					{/* Breadcrumbs: Shown on deeper pages, hidden on top-level nav pages */}
					{showBreadcrumbs && (
						<div className="hidden md:block pb-3">
							<Breadcrumbs />
						</div>
					)}
				</div>
			</nav>

			{/* Mobile Navigation Menu */}
			<MobileNav
				isOpen={mobileMenuOpen}
				onClose={handleCloseMobileMenu}
				user={user}
				isAdmin={isAdmin}
			/>
		</>
	)
}
