import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Avatar, AvatarGroup } from '../../components/ui'

describe('Avatar Component', () => {
	it('should render with fallback text when no image is provided', () => {
		render(<Avatar fallback="JD" alt="John Doe" />)

		const avatar = screen.getByLabelText('John Doe')
		expect(avatar).toBeInTheDocument()
		expect(avatar).toHaveTextContent('JD')
	})

	it('should render with image when src is provided', () => {
		render(<Avatar src="https://example.com/avatar.jpg" alt="User avatar" />)

		const avatar = screen.getByLabelText('User avatar')
		expect(avatar).toBeInTheDocument()
		const image = avatar.querySelector('img')
		expect(image).toBeInTheDocument()
		expect(image).toHaveAttribute('src', 'https://example.com/avatar.jpg')
	})

	it('should show fallback when image fails to load', () => {
		render(<Avatar src="https://example.com/invalid.jpg" fallback="FB" alt="User" />)

		const avatar = screen.getByLabelText('User')
		expect(avatar).toBeInTheDocument()
		const image = avatar.querySelector('img')
		expect(image).toBeInTheDocument()
		expect(image).toBeTruthy()

		// Simulate image error by triggering onError handler
		if (image) {
			fireEvent.error(image)
		}

		// After error, fallback should be shown
		expect(screen.getByLabelText('User')).toHaveTextContent('FB')
	})

	it('should render status indicator when status prop is provided', () => {
		render(<Avatar fallback="ST" status="online" />)

		const statusIndicator = screen.getByLabelText('Status: online')
		expect(statusIndicator).toBeInTheDocument()
	})

	it('should use default fallback "?" when no fallback is provided', () => {
		render(<Avatar alt="User" />)

		expect(screen.getByLabelText('User')).toHaveTextContent('?')
	})
})

describe('AvatarGroup Component', () => {
	it('should render all avatars when count is less than max', () => {
		const avatars = [
			{ src: 'avatar1.jpg', alt: 'User 1', fallback: 'U1' },
			{ src: 'avatar2.jpg', alt: 'User 2', fallback: 'U2' },
		]

		render(<AvatarGroup avatars={avatars} max={3} />)

		expect(screen.getByLabelText('User 1')).toBeInTheDocument()
		expect(screen.getByLabelText('User 2')).toBeInTheDocument()
	})

	it('should limit avatars to max and show remaining count', () => {
		const avatars = [
			{ src: 'avatar1.jpg', alt: 'User 1', fallback: 'U1' },
			{ src: 'avatar2.jpg', alt: 'User 2', fallback: 'U2' },
			{ src: 'avatar3.jpg', alt: 'User 3', fallback: 'U3' },
			{ src: 'avatar4.jpg', alt: 'User 4', fallback: 'U4' },
			{ src: 'avatar5.jpg', alt: 'User 5', fallback: 'U5' },
		]

		render(<AvatarGroup avatars={avatars} max={3} />)

		// Should show first 3 avatars
		expect(screen.getByLabelText('User 1')).toBeInTheDocument()
		expect(screen.getByLabelText('User 2')).toBeInTheDocument()
		expect(screen.getByLabelText('User 3')).toBeInTheDocument()

		// Should show remaining count
		const remainingBadge = screen.getByLabelText('2 more avatars')
		expect(remainingBadge).toBeInTheDocument()
		expect(remainingBadge).toHaveTextContent('+2')
	})

	it('should use default max of 3', () => {
		const avatars = [
			{ fallback: 'U1' },
			{ fallback: 'U2' },
			{ fallback: 'U3' },
			{ fallback: 'U4' },
		]

		render(<AvatarGroup avatars={avatars} />)

		expect(screen.getByText('U1')).toBeInTheDocument()
		expect(screen.getByText('U2')).toBeInTheDocument()
		expect(screen.getByText('U3')).toBeInTheDocument()
		expect(screen.getByLabelText('1 more avatars')).toBeInTheDocument()
	})
})
