import { useState, useRef, useEffect, type MouseEvent, type KeyboardEvent } from 'react'

export function SkipLink() {
	const [focused, setFocused] = useState(false)
	const blurHandlerRef = useRef<(() => void) | null>(null)

	useEffect(() => {
		return () => {
			// Cleanup: remove blur handler if component unmounts
			if (blurHandlerRef.current) {
				blurHandlerRef.current()
			}
		}
	}, [])

	const handleSkip = (e: MouseEvent<HTMLAnchorElement> | KeyboardEvent<HTMLAnchorElement>) => {
		e.preventDefault()
		const main = document.querySelector('#main-content') as HTMLElement | null
		if (main) {
			// Remove any existing blur handler
			if (blurHandlerRef.current) {
				blurHandlerRef.current()
			}

			// Set up blur handler to remove tabindex when main loses focus
			const handleBlur = () => {
				main.removeAttribute('tabindex')
				main.removeEventListener('blur', handleBlur)
				blurHandlerRef.current = null
			}

			// Create cleanup function
			const cleanup = () => {
				main.removeEventListener('blur', handleBlur)
				blurHandlerRef.current = null
			}

			main.tabIndex = -1
			main.focus()
			main.addEventListener('blur', handleBlur)
			blurHandlerRef.current = cleanup
		}
	}

	return (
		<a
			href="#main-content"
			onFocus={() => setFocused(true)}
			onBlur={() => setFocused(false)}
			onClick={handleSkip}
			onKeyDown={(e) => {
				if (e.key === 'Enter') {
					handleSkip(e)
				}
			}}
			className={`
        fixed top-0 left-0 p-3 bg-primary-600 text-white z-[100] transition-transform duration-200
        ${focused ? 'translate-y-0' : '-translate-y-full'}
      `}>
			Skip to main content
		</a>
	)
}
