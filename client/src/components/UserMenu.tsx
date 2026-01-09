import { Link } from 'react-router-dom'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Avatar, Button, ChevronDownIcon } from '@/components/ui'
import { getInitials } from '@/lib/utils'

export interface UserMenuProps {
	user: {
		id: string
		name?: string
		email?: string
		username?: string | null
		image?: string | null
	}
	isAdmin?: boolean
	onLogout?: () => void
}

/**
 * UserMenu component - dropdown menu for user actions.
 */
export function UserMenu({ user, isAdmin = false, onLogout }: UserMenuProps) {
	const displayName = user.name || user.username || user.email || 'User'
	const initials = getInitials(user.name, user.username)

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					aria-label="User menu"
					leftIcon={
						<Avatar
							src={user.image || undefined}
							alt={displayName}
							fallback={initials}
							size="sm"
						/>
					}
					rightIcon={<ChevronDownIcon className="w-4 h-4 text-text-secondary opacity-50" />}
					className="rounded-full p-1.5 hover:bg-background-secondary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 data-[state=open]:bg-background-secondary">
					<span className="hidden md:inline text-sm font-medium text-text-primary">
						{displayName}
					</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-64">
				<div className="px-3 py-2 border-b border-border-default mb-2">
					<p className="text-sm font-semibold text-text-primary">{displayName}</p>
					{user.email && (
						<p className="text-xs text-text-tertiary truncate">{user.email}</p>
					)}
				</div>

				<DropdownMenuItem asChild>
					<Link to={`/@${user.username || user.id}`} className="w-full cursor-pointer">
						View Profile
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link to="/settings" className="w-full cursor-pointer">
						Settings
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link to="/reminders" className="w-full cursor-pointer">
						Reminders
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link to="/templates" className="w-full cursor-pointer">
						Templates
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link to="/followers/pending" className="w-full cursor-pointer">
						Followers
					</Link>
				</DropdownMenuItem>

				{isAdmin && (
					<DropdownMenuItem asChild>
						<Link to="/admin" className="w-full cursor-pointer">
							Admin
						</Link>
					</DropdownMenuItem>
				)}

				<div className="border-t border-border-default my-1" />

				<DropdownMenuItem asChild>
					<button
						type="button"
						onClick={onLogout}
						className="w-full cursor-pointer text-error-600 hover:bg-error-50 hover:text-error-700 dark:hover:bg-error-900/20">
						Logout
					</button>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
