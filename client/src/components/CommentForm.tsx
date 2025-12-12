import {
	useState,
	useRef,
	useCallback,
	useEffect,
	type ChangeEvent,
	type KeyboardEvent,
	type FormEvent,
} from 'react'

import { api } from '@/lib/api-client'
import { logger } from '@/lib/logger'

import { MentionAutocomplete, MentionSuggestion } from './MentionAutocomplete'
import { Button } from './ui/Button'

interface CommentFormProps {
	onSubmit: (content: string) => Promise<void>
	placeholder?: string
	initialValue?: string
	submitLabel?: string
	onCancel?: () => void
	isSubmitting?: boolean
	autoFocus?: boolean
}

const mentionTriggerRegex = /(^|[\s({[]])@([\w.-]+(?:@[\w.-]+)?)$/i

export function CommentForm({
	onSubmit,
	placeholder = 'Add a comment...',
	initialValue = '',
	submitLabel = 'Post Comment',
	onCancel,
	isSubmitting = false,
	autoFocus = false,
}: CommentFormProps) {
	const [content, setContent] = useState(initialValue)
	const [mentionQuery, setMentionQuery] = useState('')
	const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([])
	const [activeMentionIndex, setActiveMentionIndex] = useState(0)
	const [mentionRange, setMentionRange] = useState<{ start: number; end: number } | null>(null)
	const [showMentionSuggestions, setShowMentionSuggestions] = useState(false)
	const textareaRef = useRef<HTMLTextAreaElement | null>(null)

	const resetMentionState = useCallback(() => {
		setMentionRange(null)
		setMentionQuery('')
		setMentionSuggestions([])
		setShowMentionSuggestions(false)
		setActiveMentionIndex(0)
	}, [])

	const updateMentionState = useCallback(
		(value: string, caretPosition: number) => {
			if (caretPosition < 0) {
				resetMentionState()
				return
			}

			const textBeforeCaret = value.slice(0, caretPosition)
			const match = textBeforeCaret.match(mentionTriggerRegex)

			if (match && match[2]) {
				const atIndex = textBeforeCaret.lastIndexOf('@')
				if (atIndex >= 0) {
					setMentionRange({ start: atIndex, end: caretPosition })
					setMentionQuery(match[2])
					setShowMentionSuggestions(true)
					return
				}
			}

			resetMentionState()
		},
		[resetMentionState]
	)

	const applyMentionSuggestion = useCallback(
		(suggestion: MentionSuggestion) => {
			if (!mentionRange || !textareaRef.current) {
				return
			}

			const currentValue = textareaRef.current.value
			const before = currentValue.slice(0, mentionRange.start)
			const after = currentValue.slice(mentionRange.end)
			const insertion = `@${suggestion.username}`
			const needsSpace = after.startsWith(' ') || after.length === 0 ? '' : ' '
			const nextValue = `${before}${insertion}${needsSpace}${after}`

			setContent(nextValue)
			const newCaret = before.length + insertion.length + needsSpace.length

			requestAnimationFrame(() => {
				if (textareaRef.current) {
					textareaRef.current.selectionStart = newCaret
					textareaRef.current.selectionEnd = newCaret
				}
			})

			resetMentionState()
		},
		[mentionRange, resetMentionState]
	)

	const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
		const { value } = e.target
		setContent(value)
		// selectionStart is always a number in change events
		const caret = e.target.selectionStart ?? value.length
		updateMentionState(value, caret)
	}

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (!showMentionSuggestions || mentionSuggestions.length === 0) {
			return
		}

		if (e.key === 'ArrowDown') {
			e.preventDefault()
			setActiveMentionIndex((prev) => (prev + 1) % mentionSuggestions.length)
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			setActiveMentionIndex((prev) => (prev === 0 ? mentionSuggestions.length - 1 : prev - 1))
		} else if (e.key === 'Enter') {
			e.preventDefault()
			if (activeMentionIndex >= 0 && activeMentionIndex < mentionSuggestions.length) {
				applyMentionSuggestion(mentionSuggestions[activeMentionIndex])
			}
		} else if (e.key === 'Escape') {
			e.preventDefault()
			resetMentionState()
		}
	}

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault()
		if (!content.trim() || isSubmitting) {
			return
		}

		await onSubmit(content)
		setContent('')
		resetMentionState()
		textareaRef.current?.focus()
	}

	useEffect(() => {
		if (!mentionQuery || mentionQuery.length === 0) {
			// Use setTimeout to avoid synchronous setState in effect
			setTimeout(() => {
				setMentionSuggestions([])
				setShowMentionSuggestions(false)
			}, 0)
			return
		}

		const controller = new AbortController()
		const timeout = setTimeout(async () => {
			try {
				const body = await api.get<{ users?: MentionSuggestion[] }>(
					'/user-search',
					{ q: mentionQuery, limit: 5 },
					{ signal: controller.signal }
				)
				const suggestions = Array.isArray(body.users) ? body.users.slice(0, 5) : []
				setMentionSuggestions(suggestions)
				setActiveMentionIndex(0)
				setShowMentionSuggestions(suggestions.length > 0)
			} catch (error) {
				if (!controller.signal.aborted) {
					logger.error('Failed to load mention suggestions:', error)
				}
			}
		}, 200)

		return () => {
			controller.abort()
			clearTimeout(timeout)
		}
	}, [mentionQuery])

	return (
		<form onSubmit={handleSubmit} className="space-y-3">
			<div className="relative">
				<textarea
					ref={textareaRef}
					value={content}
					onChange={handleChange}
					onKeyDown={handleKeyDown}
					onSelect={() => {
						if (textareaRef.current) {
							// selectionStart is always a number when textarea exists
							const selectionStart = textareaRef.current.selectionStart ?? textareaRef.current.value.length
							updateMentionState(
								textareaRef.current.value,
								selectionStart
							)
						}
					}}
					onClick={() => {
						if (textareaRef.current) {
							// selectionStart is always a number when textarea exists
							const selectionStart = textareaRef.current.selectionStart ?? textareaRef.current.value.length
							updateMentionState(
								textareaRef.current.value,
								selectionStart
							)
						}
					}}
					placeholder={placeholder}
					className="w-full px-3 py-2 border border-border-default rounded-lg bg-background-primary text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 resize-y min-h-[80px]"
					rows={3}
					autoFocus={autoFocus}
					disabled={isSubmitting}
				/>
				<MentionAutocomplete
					suggestions={mentionSuggestions}
					activeIndex={activeMentionIndex}
					onSelect={applyMentionSuggestion}
					visible={showMentionSuggestions}
				/>
			</div>
			<div className="flex gap-2">
				<Button
					type="submit"
					variant="primary"
					disabled={isSubmitting || !content.trim()}
					loading={isSubmitting}>
					{isSubmitting ? 'Posting...' : submitLabel}
				</Button>
				{onCancel && (
					<Button
						type="button"
						variant="ghost"
						onClick={onCancel}
						disabled={isSubmitting}>
						Cancel
					</Button>
				)}
			</div>
		</form>
	)
}
