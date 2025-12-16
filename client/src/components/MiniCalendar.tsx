import { useMemo } from 'react'

import { useEvents } from '@/hooks/queries'

import { eventsWithinRange } from '../lib/recurrence'

import { Button } from './ui'

interface MiniCalendarProps {
	selectedDate: Date
	onDateSelect: (date: Date) => void
}

export function MiniCalendar({ selectedDate, onDateSelect }: MiniCalendarProps) {
	const { data } = useEvents(100)
	const events = useMemo(() => data?.events || [], [data?.events])

	const monthRange = useMemo(() => {
		const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
		const end = new Date(
			selectedDate.getFullYear(),
			selectedDate.getMonth() + 1,
			0,
			23,
			59,
			59,
			999
		)
		return {
			start,
			end,
			startMs: start.getTime(),
			endMs: end.getTime(),
		}
	}, [selectedDate])

	const monthlyEvents = useMemo(
		() => eventsWithinRange(events, monthRange.start, monthRange.end),
		[events, monthRange.start, monthRange.end]
	)

	const getDaysInMonth = (date: Date) => {
		const year = date.getFullYear()
		const month = date.getMonth()
		const firstDay = new Date(year, month, 1)
		const lastDay = new Date(year, month + 1, 0)
		const daysInMonth = lastDay.getDate()
		const startingDayOfWeek = firstDay.getDay()

		return { daysInMonth, startingDayOfWeek, year, month }
	}

	const getEventsForDay = (day: number) => {
		const { year, month } = getDaysInMonth(selectedDate)
		const dayDate = new Date(year, month, day)
		const dayStart = new Date(dayDate.setHours(0, 0, 0, 0))
		const dayEnd = new Date(dayDate.setHours(23, 59, 59, 999))

		return monthlyEvents.filter((event) => {
			const eventDate = new Date(event.startTime)
			return eventDate >= dayStart && eventDate <= dayEnd
		})
	}

	const previousMonth = () => {
		onDateSelect(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))
	}

	const nextMonth = () => {
		onDateSelect(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))
	}

	const goToToday = () => {
		onDateSelect(new Date())
	}

	const handleDayClick = (day: number) => {
		const { year, month } = getDaysInMonth(selectedDate)
		onDateSelect(new Date(year, month, day))
	}

	const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(selectedDate)
	const monthName = selectedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
	const today = new Date()

	return (
		<div className="p-4 bg-background-primary border border-border-default rounded-lg">
			<div className="flex items-center justify-between mb-3">
				<h3 className="font-bold text-sm text-text-primary">{monthName}</h3>
				<div className="flex items-center gap-1">
					<Button
						onClick={previousMonth}
						variant="ghost"
						size="sm"
						className="p-1 hover:bg-background-secondary rounded text-text-secondary"
						aria-label="Previous month">
						←
					</Button>
					<Button
						onClick={nextMonth}
						variant="ghost"
						size="sm"
						className="p-1 hover:bg-background-secondary rounded text-text-secondary"
						aria-label="Next month">
						→
					</Button>
					<Button
						onClick={nextMonth}
						variant="ghost"
						size="sm"
						className="p-1 hover:bg-background-secondary rounded text-text-secondary"
						aria-label="Next month">
						→
					</Button>
				</div>
			</div>

			{/* Day headers */}
			<div className="grid grid-cols-7 gap-1 mb-1">
				{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => {
					const dayNames = [
						'Sunday',
						'Monday',
						'Tuesday',
						'Wednesday',
						'Thursday',
						'Friday',
						'Saturday',
					]
					return (
						<div
							key={`day-header-${dayNames[index]}`}
							className="text-center text-xs font-semibold text-text-tertiary py-1">
							{day}
						</div>
					)
				})}
			</div>

			{/* Calendar days */}
			<div className="grid grid-cols-7 gap-1">
				{/* Empty cells for days before month starts */}
				{Array.from({ length: startingDayOfWeek }).map((_, i) => {
					const prevMonth = month === 0 ? 11 : month - 1
					const prevYear = month === 0 ? year - 1 : year
					const lastDayOfPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate()
					const dayNumber = lastDayOfPrevMonth - startingDayOfWeek + i + 1
					return (
						<div
							key={`empty-${prevYear}-${prevMonth}-${dayNumber}`}
							className="aspect-square"
						/>
					)
				})}

				{/* Days of the month */}
				{Array.from({ length: daysInMonth }).map((_, i) => {
					const day = i + 1
					const dayEvents = getEventsForDay(day)
					const dayDate = new Date(
						selectedDate.getFullYear(),
						selectedDate.getMonth(),
						day
					)
					const isToday = dayDate.toDateString() === today.toDateString()
					const isSelected = dayDate.toDateString() === selectedDate.toDateString()

					return (
						<Button
							key={day}
							onClick={() => handleDayClick(day)}
							variant="ghost"
							size="sm"
							className={`aspect-square text-xs rounded hover:bg-background-secondary transition-colors relative ${
								isToday ? 'ring-1 ring-primary-500 font-semibold' : ''
							} ${
								isSelected
									? 'bg-primary-600 text-white hover:bg-primary-700'
									: 'text-text-primary'
							}`}>
							{day}
							{dayEvents.length > 0 && (
								<div
									className={`absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full ${
										isSelected ? 'bg-white' : 'bg-primary-500'
									}`}
								/>
							)}
						</Button>
					)
				})}
			</div>

			<Button
				onClick={goToToday}
				variant="ghost"
				size="sm"
				className="mt-3 w-full text-xs text-primary-600 hover:text-primary-700 hover:underline dark:text-primary-400 dark:hover:text-primary-300">
				Go to today
			</Button>
		</div>
	)
}
