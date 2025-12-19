import { useState, type MouseEvent, type KeyboardEvent } from 'react'

export function SkipLink() {
	const [focused, setFocused] = useState(false)

	const handleSkip = (e: MouseEvent<HTMLAnchorElement> | KeyboardEvent<HTMLAnchorElement>) => {
		e.preventDefault()
		const main = document.querySelector('#main-content') as HTMLElement | null
		if (main) {
			main.tabIndex = -1
			main.focus()
			setTimeout(() => {
				main.removeAttribute('tabindex')
			}, 1000)
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
