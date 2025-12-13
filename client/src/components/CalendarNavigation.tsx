import { useState, useRef, useEffect, type ChangeEvent } from 'react'

import { Stack } from './layout'
import { Button, Input } from './ui'

interface CalendarNavigationProps {
	view: 'month' | 'week' | 'day'
	currentDate: Date
	onViewChange: (view: 'month' | 'week' | 'day') => void
	onDateChange: (date: Date) => void
	displayText: string
}

export function CalendarNavigation({
	view,
	currentDate,
	onViewChange,
	onDateChange,
	displayText,
}: CalendarNavigationProps) {
	const [showDatePicker, setShowDatePicker] = useState(false)
	const datePickerRef = useRef<HTMLDivElement>(null)

	// Close date picker when clicking outside
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
				setShowDatePicker(false)
			}
		}

		if (showDatePicker) {
			document.addEventListener('mousedown', handleClickOutside)
			return () => document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [showDatePicker])

	const navigatePrevious = () => {
		if (view === 'month') {
			onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
		} else if (view === 'week') {
			const newDate = new Date(
				currentDate.getFullYear(),
				currentDate.getMonth(),
				currentDate.getDate() - 7
			)
			onDateChange(newDate)
		} else {
			const newDate = new Date(
				currentDate.getFullYear(),
				currentDate.getMonth(),
				currentDate.getDate() - 1
			)
			onDateChange(newDate)
		}
	}

	const navigateNext = () => {
		if (view === 'month') {
			onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
		} else if (view === 'week') {
			const newDate = new Date(
				currentDate.getFullYear(),
				currentDate.getMonth(),
				currentDate.getDate() + 7
			)
			onDateChange(newDate)
		} else {
			const newDate = new Date(
				currentDate.getFullYear(),
				currentDate.getMonth(),
				currentDate.getDate() + 1
			)
			onDateChange(newDate)
		}
	}

	const goToToday = () => {
		onDateChange(new Date())
		setShowDatePicker(false)
	}

	const handleDatePickerChange = (e: ChangeEvent<HTMLInputElement>) => {
		const date = new Date(e.target.value)
		if (!Number.isNaN(date.getTime())) {
			onDateChange(date)
			setShowDatePicker(false)
		}
	}

	const formatDateForInput = (date: Date) => {
		const year = date.getFullYear()
		const month = String(date.getMonth() + 1).padStart(2, '0')
		const day = String(date.getDate()).padStart(2, '0')
		return `${year}-${month}-${day}`
	}

	return (
		<Stack
			direction="column"
			directionSm="row"
			justify="between"
			align="start"
			alignSm="center"
			gap="md"
			className="mb-6">
			{/* View Switcher */}
			<div
				className="flex gap-1 bg-background-primary rounded-lg p-1 border border-border-default"
				role="group"
				aria-label="Calendar view options">
				<Button
					variant={view === 'month' ? 'primary' : 'ghost'}
					size="sm"
					onClick={() => onViewChange('month')}
					aria-pressed={view === 'month'}
					aria-label="Month view">
					Month
				</Button>
				<Button
					variant={view === 'week' ? 'primary' : 'ghost'}
					size="sm"
					onClick={() => onViewChange('week')}
					aria-pressed={view === 'week'}
					aria-label="Week view">
					Week
				</Button>
				<Button
					variant={view === 'day' ? 'primary' : 'ghost'}
					size="sm"
					onClick={() => onViewChange('day')}
					aria-pressed={view === 'day'}
					aria-label="Day view">
					Day
				</Button>
			</div>

			{/* Navigation Controls */}
			<div className="flex gap-2 items-center">
				<Button variant="secondary" size="sm" onClick={goToToday}>
					Today
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={navigatePrevious}
					aria-label={`Previous ${view}`}
					leftIcon={<span>←</span>}>
					<span className="sr-only">Previous {view}</span>
				</Button>

				{/* Date Display with Picker */}
				<div className="relative" ref={datePickerRef}>
					<Button
						onClick={() => setShowDatePicker(!showDatePicker)}
						variant="ghost"
						size="sm"
						className="px-4 py-2 text-sm font-medium min-w-[280px] text-center hover:bg-background-secondary rounded-lg transition-colors"
						aria-label="Select date">
						{displayText}
					</Button>

					{showDatePicker && (
						<div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-background-primary border border-border-default rounded-lg shadow-lg p-4 z-50 min-w-[280px]">
							<Input
								type="date"
								label="Jump to date"
								value={formatDateForInput(currentDate)}
								onChange={handleDatePickerChange}
								size="sm"
							/>
							<Button
								variant="secondary"
								size="sm"
								fullWidth
								onClick={goToToday}
								className="mt-3">
								Go to Today
							</Button>
						</div>
					)}
				</div>

				<Button
					variant="ghost"
					size="sm"
					onClick={navigateNext}
					aria-label={`Next ${view}`}
					rightIcon={<span>→</span>}>
					<span className="sr-only">Next {view}</span>
				</Button>
			</div>
		</Stack>
	)
}
