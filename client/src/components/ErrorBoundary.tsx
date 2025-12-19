import React, { Component, type ReactNode } from 'react'

import { logger } from '@/lib/logger'
import { ErrorPage } from '@/pages/ErrorPage'

export interface ErrorBoundaryProps {
	children: ReactNode
	fallback?: ReactNode
	onError?: (error: Error, errorInfo: React.ErrorInfo) => void
	resetKeys?: Array<string | number>
	resetOnPropsChange?: boolean
}

interface ErrorBoundaryState {
	hasError: boolean
	error: Error | null
	errorInfo: React.ErrorInfo | null
}

/**
 * Error Boundary component that catches React errors in the component tree
 * and displays a fallback UI with recovery options.
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props)
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
		}
	}

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		return {
			hasError: true,
			error,
		}
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		// Log error
		logger.error('ErrorBoundary caught an error:', error, errorInfo)

		this.setState({
			error,
			errorInfo,
		})

		// Call optional error handler
		if (this.props.onError) {
			this.props.onError(error, errorInfo)
		}
	}

	componentDidUpdate(prevProps: ErrorBoundaryProps) {
		const { resetKeys, resetOnPropsChange } = this.props
		const { hasError } = this.state

		// Reset error boundary if resetKeys have changed
		if (hasError && resetKeys && prevProps.resetKeys) {
			const hasResetKeyChanged = resetKeys.some(
				(key, index) => key !== prevProps.resetKeys?.[index]
			)
			if (hasResetKeyChanged) {
				this.resetErrorBoundary()
			}
		}

		// Reset error boundary if resetOnPropsChange is true and props have changed
		if (hasError && resetOnPropsChange) {
			const propsChanged = Object.keys(this.props).some(
				(key) =>
					key !== 'children' &&
					this.props[key as keyof ErrorBoundaryProps] !==
						prevProps[key as keyof ErrorBoundaryProps]
			)
			if (propsChanged) {
				this.resetErrorBoundary()
			}
		}
	}

	resetErrorBoundary = () => {
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
		})
	}

	render() {
		if (this.state.hasError) {
			// Use custom fallback if provided
			if (this.props.fallback) {
				return this.props.fallback
			}

			// Use the styled ErrorPage component
			return (
				<ErrorPage
					error={this.state.error || undefined}
					errorInfo={this.state.errorInfo}
					resetErrorBoundary={this.resetErrorBoundary}
				/>
			)
		}

		return this.props.children
	}
}
