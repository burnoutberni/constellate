import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview'
import { setProjectAnnotations } from '@storybook/react-vite'
import { beforeAll, afterAll } from 'vitest'
import * as projectAnnotations from './preview'

// This is an important step to apply the right configuration when testing your stories.
// More info at: https://storybook.js.org/docs/api/portable-stories/portable-stories-vitest#setprojectannotations
setProjectAnnotations([a11yAddonAnnotations, projectAnnotations])

// Suppress React act() warnings in Storybook tests
// These warnings occur when React Query hooks trigger async state updates,
// which is expected behavior in Storybook stories
const originalError = console.error
beforeAll(() => {
	console.error = (...args: unknown[]) => {
		const message = typeof args[0] === 'string' ? args[0] : String(args[0])
		// Suppress act() warnings for Storybook tests
		if (
			message.includes('An update to') &&
			message.includes('inside a test was not wrapped in act(...)')
		) {
			return
		}
		// Suppress expected ErrorBoundary error output in stderr
		if (
			message.includes('ErrorBoundary caught an error') ||
			message.includes('The above error occurred in the')
		) {
			return
		}
		originalError.call(console, ...args)
	}
})

afterAll(() => {
	console.error = originalError
})
