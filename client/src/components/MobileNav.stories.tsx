import type { Meta, StoryObj } from '@storybook/react'
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { MemoryRouter } from 'react-router-dom'

import { MobileNav } from './MobileNav'
import { Button } from './ui'

// Simple wrapper that prevents route-change closes in Storybook
const StoryWrapperInner = (args: React.ComponentProps<typeof MobileNav>) => {
	const [isOpen, setIsOpen] = useState(true)
	const ignoreRouteCloseRef = useRef(true)

	// Prevent route-change closes for initial period
	useEffect(() => {
		const timer = setTimeout(() => {
			ignoreRouteCloseRef.current = false
		}, 2000)
		return () => clearTimeout(timer)
	}, [])

	// Simple close handler - ignore route changes
	const handleClose = useCallback(() => {
		if (ignoreRouteCloseRef.current) {
			return // Ignore closes during initial period
		}
		setIsOpen(false)
	}, [])

	// Prevent body scroll lock in Storybook
	useEffect(() => {
		if (isOpen) {
			const restoreScroll = () => {
				if (document.body.style.overflow === 'hidden') {
					document.body.style.overflow = ''
				}
			}

			restoreScroll()
			requestAnimationFrame(restoreScroll)
			const timers = [
				setTimeout(restoreScroll, 0),
				setTimeout(restoreScroll, 10),
				setTimeout(restoreScroll, 50),
			]

			const observer = new MutationObserver(() => {
				restoreScroll()
			})
			observer.observe(document.body, {
				attributes: true,
				attributeFilter: ['style'],
			})

			return () => {
				timers.forEach(clearTimeout)
				observer.disconnect()
			}
		}
	}, [isOpen])

	// Prevent auto-scroll in Storybook docs view
	useEffect(() => {
		const scrollToTop = () => {
			const selectors = [
				'[data-storybook-docs]',
				'.sbdocs',
				'.docs-story',
				'.sbdocs-content',
				'[id^="story--"]',
				'.os-host',
				'.os-viewport',
			]

			for (const selector of selectors) {
				const containers = document.querySelectorAll(selector)
				containers.forEach((container) => {
					if (container) {
						const element = container as HTMLElement
						element.scrollTop = 0
					}
				})
			}

			window.scrollTo({ top: 0, behavior: 'instant' })
		}

		scrollToTop()
		const timers = [
			setTimeout(scrollToTop, 50),
			setTimeout(scrollToTop, 100),
			setTimeout(scrollToTop, 200),
			setTimeout(scrollToTop, 500),
		]

		const handleHashChange = () => {
			requestAnimationFrame(scrollToTop)
		}
		window.addEventListener('hashchange', handleHashChange)

		return () => {
			timers.forEach(clearTimeout)
			window.removeEventListener('hashchange', handleHashChange)
		}
	}, [])

	const { onClose: _, isOpen: __, ...restArgs } = args

	return (
		<div
			style={{
				position: 'relative',
				minHeight: '600px',
				height: '600px',
				width: '100%',
				overflow: 'hidden',
			}}>
			<Button onClick={() => setIsOpen(true)}>Open Mobile Nav</Button>
			<MobileNav {...restArgs} isOpen={isOpen} onClose={handleClose} />
		</div>
	)
}

const StoryWrapper = (args: React.ComponentProps<typeof MobileNav>) => {
	return (
		<MemoryRouter initialEntries={['/']}>
			<StoryWrapperInner {...args} />
		</MemoryRouter>
	)
}

const meta = {
	title: 'Components/MobileNav',
	component: MobileNav,
	parameters: {
		layout: 'fullscreen',
		docs: {
			canvas: {
				height: '600px',
			},
			story: {
				inline: false,
			},
		},
	},
	tags: ['autodocs'],
	args: {
		isOpen: false,
		onClose: () => { },
		user: {
			id: 'user1',
			name: 'John Doe',
			email: 'john@example.com',
			username: 'johndoe',
			isRemote: false,
		},
	},
	argTypes: {
		onClose: {
			control: false,
		},
	},
} satisfies Meta<typeof MobileNav>

export default meta
type Story = StoryObj<typeof MobileNav>

export const Default: Story = {
	render: (args) => <StoryWrapper {...args} />,
	parameters: {
		docs: {
			story: {
				inline: true,
			},
			source: {
				state: 'open',
			},
		},
		layout: 'fullscreen',
	},
}

const WithAdminWrapperInner = () => {
	const [isOpen, setIsOpen] = useState(true)
	const ignoreRouteCloseRef = useRef(true)

	useEffect(() => {
		const timer = setTimeout(() => {
			ignoreRouteCloseRef.current = false
		}, 2000)
		return () => clearTimeout(timer)
	}, [])

	const handleClose = useCallback(() => {
		if (ignoreRouteCloseRef.current) {
			return
		}
		setIsOpen(false)
	}, [])

	useEffect(() => {
		if (isOpen) {
			const restoreScroll = () => {
				if (document.body.style.overflow === 'hidden') {
					document.body.style.overflow = ''
				}
			}

			restoreScroll()
			requestAnimationFrame(restoreScroll)
			const timers = [
				setTimeout(restoreScroll, 0),
				setTimeout(restoreScroll, 10),
				setTimeout(restoreScroll, 50),
			]

			const observer = new MutationObserver(() => {
				restoreScroll()
			})
			observer.observe(document.body, {
				attributes: true,
				attributeFilter: ['style'],
			})

			return () => {
				timers.forEach(clearTimeout)
				observer.disconnect()
			}
		}
	}, [isOpen])

	const mockUser = {
		id: 'user1',
		name: 'John Doe',
		email: 'john@example.com',
		username: 'johndoe',
		isRemote: false,
	}

	return (
		<div
			style={{
				position: 'relative',
				display: 'block',
				minHeight: '600px',
				height: '600px',
				width: '100%',
				overflow: 'hidden',
			}}>
			<Button onClick={() => setIsOpen(true)}>Open Menu</Button>
			<MobileNav isOpen={isOpen} onClose={handleClose} user={mockUser} isAdmin={true} />
		</div>
	)
}

const WithAdminWrapper = () => {
	return (
		<MemoryRouter initialEntries={['/']}>
			<WithAdminWrapperInner />
		</MemoryRouter>
	)
}

export const WithAdmin: Story = {
	render: () => <WithAdminWrapper />,
	parameters: {
		docs: {
			canvas: {
				height: '600px',
			},
			story: {
				inline: true,
			},
		},
		layout: 'fullscreen',
	},
}

const NoUserWrapperInner = () => {
	const [isOpen, setIsOpen] = useState(true)
	const ignoreRouteCloseRef = useRef(true)

	useEffect(() => {
		const timer = setTimeout(() => {
			ignoreRouteCloseRef.current = false
		}, 2000)
		return () => clearTimeout(timer)
	}, [])

	const handleClose = useCallback(() => {
		if (ignoreRouteCloseRef.current) {
			return
		}
		setIsOpen(false)
	}, [])

	useEffect(() => {
		if (isOpen) {
			const restoreScroll = () => {
				if (document.body.style.overflow === 'hidden') {
					document.body.style.overflow = ''
				}
			}

			restoreScroll()
			requestAnimationFrame(restoreScroll)
			const timers = [
				setTimeout(restoreScroll, 0),
				setTimeout(restoreScroll, 10),
				setTimeout(restoreScroll, 50),
			]

			const observer = new MutationObserver(() => {
				restoreScroll()
			})
			observer.observe(document.body, {
				attributes: true,
				attributeFilter: ['style'],
			})

			return () => {
				timers.forEach(clearTimeout)
				observer.disconnect()
			}
		}
	}, [isOpen])

	return (
		<div
			style={{
				position: 'relative',
				display: 'block',
				minHeight: '600px',
				height: '600px',
				width: '100%',
				overflow: 'hidden',
			}}>
			<Button onClick={() => setIsOpen(true)}>Open Menu</Button>
			<MobileNav isOpen={isOpen} onClose={handleClose} />
		</div>
	)
}

const NoUserWrapper = () => {
	return (
		<MemoryRouter initialEntries={['/']}>
			<NoUserWrapperInner />
		</MemoryRouter>
	)
}

export const NoUser: Story = {
	render: () => <NoUserWrapper />,
	parameters: {
		docs: {
			canvas: {
				height: '600px',
			},
			story: {
				inline: true,
			},
		},
		layout: 'fullscreen',
	},
}
