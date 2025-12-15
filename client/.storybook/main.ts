import type { StorybookConfig } from '@storybook/react-vite'
import path from 'path'
import { fileURLToPath } from 'url'

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
		// Configure base path for Storybook
		config.base = '/ui/'

		// Add path aliases from vite.config.ts
		if (!config.resolve) {
			config.resolve = {}
		}
		if (!config.resolve.alias) {
			config.resolve.alias = {}
		}

		const aliases = {
			'better-auth/react': path.resolve(
				__dirname,
				'../node_modules/better-auth/dist/client/react/index.mjs'
			),
			'@/components/ui': path.resolve(__dirname, '../src/components/ui/index.ts'),
			'@/components/layout': path.resolve(__dirname, '../src/components/layout/index.ts'),
			'@/components/icons': path.resolve(__dirname, '../src/components/icons/index.ts'),
			'@/design-system': path.resolve(__dirname, '../src/design-system/index.ts'),
			'@/types': path.resolve(__dirname, '../src/types/index.ts'),
			'@/hooks/queries': path.resolve(__dirname, '../src/hooks/queries/index.ts'),
			'@/stores': path.resolve(__dirname, '../src/stores/index.ts'),
			'@/lib': path.resolve(__dirname, '../src/lib'),
			'@/components': path.resolve(__dirname, '../src/components'),
			'@/hooks': path.resolve(__dirname, '../src/hooks'),
			'@/pages': path.resolve(__dirname, '../src/pages'),
			'@/contexts': path.resolve(__dirname, '../src/contexts'),
		}

		Object.assign(config.resolve.alias, aliases)

		return config
	},
}
export default config
