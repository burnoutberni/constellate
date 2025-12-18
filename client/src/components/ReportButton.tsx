import { useState } from 'react'

import { ReportContentModal } from './ReportContentModal'
import { Button } from './ui'

interface ReportButtonProps {
	targetType: 'user' | 'event' | 'comment'
	targetId: string
	contentTitle?: string
	size?: 'sm' | 'md'
	variant?: 'ghost' | 'secondary'
	className?: string
}

export function ReportButton({
	targetType,
	targetId,
	contentTitle,
	size = 'sm',
	variant = 'ghost',
	className,
}: ReportButtonProps) {
	const [isOpen, setIsOpen] = useState(false)

	const getAriaLabel = () => {
		const targetName = contentTitle || `this ${targetType}`
		return `Report ${targetName}`
	}

	return (
		<>
			<Button
				variant={variant}
				size={size}
				onClick={() => setIsOpen(true)}
				className={className}
				aria-label={getAriaLabel()}>
				🚩 Report
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
