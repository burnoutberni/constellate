interface CurrentUserData {
	id: string
	username?: string | null
	name?: string | null
	profileImage?: string | null
	displayColor?: string
	createdAt?: string
	isRemote?: boolean
	isPublicProfile?: boolean
}

const _currentUserStore: { user: CurrentUserData | null } = { user: null }

export function setCurrentUser(user: CurrentUserData | null) {
	_currentUserStore.user = user
}

export function clearCurrentUser() {
	_currentUserStore.user = null
}

export function getCurrentUser(): CurrentUserData | null {
	return _currentUserStore.user
}
