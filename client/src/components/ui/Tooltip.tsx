
import * as React from 'react'

import { cn } from '@/lib/utils'

interface TooltipProps {
	content: React.ReactNode
	children: React.ReactNode
	className?: string
	side?: 'top' | 'bottom' | 'left' | 'right'
}

export function Tooltip({ content, children, className, side = 'top' }: Readonly<TooltipProps>) {
	const [isVisible, setIsVisible] = React.useState(false)

	return (
		<div
			className={cn('relative inline-block', className)}
			onMouseEnter={() => setIsVisible(true)}
			onMouseLeave={() => setIsVisible(false)}
            onFocus={() => setIsVisible(true)}
            onBlur={() => setIsVisible(false)}
		>
			{children}
			{isVisible && (
				<div
                    className={cn(
                        "absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg whitespace-nowrap pointer-events-none",
                        side === 'top' && "bottom-full left-1/2 -translate-x-1/2 mb-1",
                        side === 'bottom' && "top-full left-1/2 -translate-x-1/2 mt-1",
                        side === 'left' && "right-full top-1/2 -translate-y-1/2 mr-1",
                        side === 'right' && "left-full top-1/2 -translate-y-1/2 ml-1"
                    )}
                    role="tooltip"
                >
					{content}
                    {/* Arrow */}
                    <div
                        className={cn(
                            "absolute w-0 h-0 border-4 border-transparent",
                            side === 'top' && "border-t-gray-900 top-full left-1/2 -translate-x-1/2",
                            side === 'bottom' && "border-b-gray-900 bottom-full left-1/2 -translate-x-1/2",
                            side === 'left' && "border-l-gray-900 left-full top-1/2 -translate-y-1/2",
                            side === 'right' && "border-r-gray-900 right-full top-1/2 -translate-y-1/2"
                        )}
                    />
				</div>
			)}
		</div>
	)
}
