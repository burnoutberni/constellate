import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useCallback, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { queryKeys } from '@/hooks/queries'
import { api } from '@/lib/api-client'
import { getNavLinks, shouldShowBreadcrumbs } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores'
import type { UserProfile } from '@/types'

import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs'
import { MobileNav } from './MobileNav'
import { NotificationBell } from './NotificationBell'
import { SearchBar } from './SearchBar'
import { Button, MenuIcon, SearchIcon } from './ui'
import { UserMenu } from './UserMenu'

type AuthenticatedUser = {
	name?: string
	email?: string
	id: string
	username?: string | null
	image?: string | null
}


export function Navbar({
	isConnected,
	user,
	onLogout,
	breadcrumbs,
}: {
	isConnected?: boolean
	user?: AuthenticatedUser | null
	onLogout?: () => void
	breadcrumbs?: BreadcrumbItem[]
}) {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
	const location = useLocation()
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const { setIsFeedRefreshing } = useUIStore()

	const handleLogoClick = async (e: React.MouseEvent) => {
		if (user) {
			e.preventDefault()
			setIsFeedRefreshing(true)

			try {
				// Invalidate queries to trigger background refetch
				// Wait for minimum animation time (1.2s) even if fetch is faster
				await Promise.all([
					queryClient.invalidateQueries({ queryKey: queryKeys.activity.home() }),
					queryClient.invalidateQueries({ queryKey: queryKeys.activity.feed() }),
					new Promise((resolve) => setTimeout(resolve, 1200)),
				])
			} catch (error) {
				console.error('Failed to refresh feed:', error)
			} finally {
				setIsFeedRefreshing(false)
				navigate('/feed')
			}
		}
	}



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

	const handleCloseMobileMenu = useCallback(() => {
		setMobileMenuOpen(false)
	}, [])

	const navLinks = getNavLinks(Boolean(user))

	const topLevelPaths = ['/', ...navLinks.map((link) => link.to)]
	const showBreadcrumbs = shouldShowBreadcrumbs(location.pathname, topLevelPaths)

	return (
		<>
			<nav
				className="bg-background-primary/80 border-b border-border-default sticky top-0 z-30 backdrop-blur-md transition-all duration-200"
				aria-label="Main navigation">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex items-center justify-between h-16 gap-4">
						{/* Left: Logo & Mobile Menu */}
						<div className="flex items-center gap-3 lg:gap-8 flex-shrink-0">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setMobileMenuOpen(true)}
								aria-label="Open mobile menu"
								aria-expanded={mobileMenuOpen}
								className="md:hidden p-2 -ml-2">
								<MenuIcon className="w-6 h-6" />
							</Button>

							<Link
								to={user ? '/feed' : '/'}
								onClick={handleLogoClick}
								className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-secondary-600 hover:opacity-80 transition-opacity">
								Constellate
							</Link>

							{/* Desktop Nav */}
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
												'px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
												isActive
													? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
													: 'text-text-secondary hover:text-text-primary hover:bg-neutral-50 dark:hover:bg-neutral-800'
											)}
											aria-current={isActive ? 'page' : undefined}>
											{link.label}
										</Link>
									)
								})}
							</nav>
						</div>

						{/* Center: Search Bar (Desktop) */}
						<div className="hidden lg:block flex-1 max-w-md">
							<SearchBar />
						</div>

						{/* Right: Actions */}
						<div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
							{/* Mobile Search Button */}
							<Button
								variant="ghost"
								size="sm"
								onClick={() => navigate('/discover')}
								aria-label="Search"
								className="lg:hidden p-2">
								<SearchIcon className="w-5 h-5" />
							</Button>

							{/* Connection Status */}
							{isConnected && (
								<div
									className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400 border border-success-200 dark:border-success-900/50 text-xs font-medium"
									aria-label="Live connection status">
									<div className="w-1.5 h-1.5 bg-success-500 rounded-full animate-pulse" />
									<span>Live</span>
								</div>
							)}

							{user ? (
								<div className="flex items-center gap-2">
									<NotificationBell userId={user.id} />
									<div className="w-px h-6 bg-border-default mx-1 hidden sm:block" />
									<UserMenu user={user} isAdmin={isAdmin} onLogout={onLogout} />
								</div>
							) : (
								<div className="flex items-center gap-2">
									<Link to="/login">
										<Button variant="ghost" size="sm" className="font-medium">
											Log In
										</Button>
									</Link>
									<Link to="/login?signup=true">
										<Button variant="primary" size="sm" className="font-medium">
											Sign Up
										</Button>
									</Link>
								</div>
							)}
						</div>
					</div>

					{/* Breadcrumbs */}
					{showBreadcrumbs && (
						<div className="hidden md:block pb-3 animate-fade-in">
							<Breadcrumbs items={breadcrumbs} />
						</div>
					)}
				</div>
			</nav>

			<MobileNav
				isOpen={mobileMenuOpen}
				onClose={handleCloseMobileMenu}
				user={user}
				isAdmin={isAdmin}
			/>
		</>
	)
}
