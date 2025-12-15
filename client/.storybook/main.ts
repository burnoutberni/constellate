import type { StorybookConfig } from '@storybook/react-vite'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const config: StorybookConfig = {
	stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
	addons: [
		'@chromatic-com/storybook',
		'@storybook/addon-vitest',
		'@storybook/addon-a11y',
		'@storybook/addon-docs',
		'@storybook/addon-onboarding',
		'@storybook/addon-themes',
	],
	framework: {
		name: '@storybook/react-vite',
		options: {},
	},
	staticDirs: [],
	viteFinal: async (config) => {
		// Import path aliases from vite.config.ts dynamically to avoid ESM conflicts
		const viteConfigPath = path.resolve(__dirname, '../vite.config.ts')
		const viteConfig = await import(pathToFileURL(viteConfigPath).href)
		const { getPathAliases } = viteConfig

		// Resolve paths relative to the client directory (parent of .storybook)
		const aliases = getPathAliases(path.resolve(__dirname, '..'))

		// Add path aliases
		if (!config.resolve) {
			config.resolve = {}
		}
		if (!config.resolve.alias) {
			config.resolve.alias = {}
		}

		Object.assign(config.resolve.alias, aliases)

		return config
	},
}
export default config
