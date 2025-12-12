import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { queryKeys } from '@/hooks/queries'
import { api } from '@/lib/api-client'
import type { UserProfile } from '@/types'

import { NotificationBell } from './NotificationBell'
import { SearchBar } from './SearchBar'
import { ThemeToggle } from './ThemeToggle'
import { Button } from './ui'


export function Navbar({
	isConnected,
	user,
	onLogout,
}: {
	isConnected?: boolean
	user?: { name?: string; email?: string; id?: string } | null
	onLogout?: () => void
}) {
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
	return (
		<nav className="bg-white border-b border-neutral-200 sticky top-0 z-10">
			<div className="max-w-6xl mx-auto px-4">
				<div className="flex items-center justify-between h-16">
					<div className="flex items-center gap-8">
						<Link
							to={user ? '/feed' : '/'}
							className="text-2xl font-bold text-info-600">
							Constellate
						</Link>
						<div className="hidden md:flex items-center gap-1">
							<Link to="/feed" className="nav-link">
								Feed
							</Link>
							<Link to="/calendar" className="nav-link">
								Calendar
							</Link>
							<Link to="/search" className="nav-link">
								Search
							</Link>
							{user && (
								<>
									<Link to="/templates" className="nav-link">
										Templates
									</Link>
									<Link to="/instances" className="nav-link">
										Instances
									</Link>
								</>
							)}
							<Link to="/about" className="nav-link">
								About
							</Link>
						</div>
					</div>
					<div className="hidden md:block flex-1 max-w-md">
						<SearchBar />
					</div>
					<div className="flex items-center gap-4">
						<ThemeToggle />
						{user ? (
							<>
								{isAdmin && (
									<Link
										to="/admin"
										className="text-sm text-neutral-700 hover:text-neutral-900">
										Admin
									</Link>
								)}
								<Link
									to="/settings"
									className="text-sm text-neutral-700 hover:text-neutral-900">
									Settings
								</Link>
								<Link
									to="/reminders"
									className="text-sm text-neutral-700 hover:text-neutral-900">
									Reminders
								</Link>
								<Link
									to="/followers/pending"
									className="text-sm text-neutral-700 hover:text-neutral-900">
									Followers
								</Link>
								<NotificationBell userId={user.id} />
								<span className="text-sm text-neutral-700">
									👤 {user.name || user.email}
								</span>
								{onLogout && (
									<Button onClick={onLogout} variant="secondary" size="sm">
										Logout
									</Button>
								)}
							</>
						) : (
							<Link to="/login" className="btn btn-primary">
								Sign In
							</Link>
						)}
						{isConnected && (
							<div className="flex items-center gap-2 text-sm text-success-600">
								<div className="w-2 h-2 bg-success-600 rounded-full" />
								<span className="hidden sm:inline">Live</span>
							</div>
						)}
					</div>
				</div>
			</div>
		</nav>
	)
}
