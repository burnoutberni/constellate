import { useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * ScrollToTop handles scroll behavior on navigation:
 * - On PUSH/REPLACE (new page), scrolls to top (0,0).
 * - On POP (back/forward), does nothing, allowing browser native scroll restoration to work.
 */
export function ScrollToTop() {
    const { pathname } = useLocation()
    const navType = useNavigationType()

    useLayoutEffect(() => {
        // If the navigation was a POP (back/forward button), let the browser handle restoration
        if (navType === 'POP') {
            return
        }

        // For PUSH or REPLACE, scroll to top
        window.scrollTo(0, 0)
    }, [pathname, navType])

    return null
}
