import { useState, type ReactNode } from 'react'

import { ReportContentModal } from './ReportContentModal'
import { Button, FlagIcon } from './ui'

interface ReportButtonProps {
	targetType: 'user' | 'event' | 'comment'
	targetId: string
	contentTitle?: string
	size?: 'sm' | 'md'
	variant?: 'ghost' | 'secondary'
	className?: string
	children?: ReactNode
}

export function ReportButton({
	targetType,
	targetId,
	contentTitle,
	size = 'sm',
	variant = 'ghost',
	className,
	children,
}: ReportButtonProps) {
	const [isOpen, setIsOpen] = useState(false)

	const getAriaLabel = () => {
		const targetName = contentTitle || `this ${targetType}`
		return `Report ${targetName}`
	}

	// Default to icon-only, but allow custom content via children
	const buttonContent = children ?? <FlagIcon className="w-4 h-4" />

	return (
		<>
			<Button
				variant={variant}
				size={size}
				onClick={() => setIsOpen(true)}
				className={className}
				aria-label={getAriaLabel()}>
				{buttonContent}
			</Button>

			<ReportContentModal
				isOpen={isOpen}
				onClose={() => setIsOpen(false)}
				targetType={targetType}
				targetId={targetId}
				contentTitle={contentTitle}
			/>
		</>
	)
}
