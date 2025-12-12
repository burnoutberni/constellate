import js from '@eslint/js'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import importPlugin from 'eslint-plugin-import'
import globals from 'globals'
import prettier from 'eslint-config-prettier'

export default [
	// Base JavaScript recommended rules
	js.configs.recommended,

	// Disable formatting rules that conflict with Prettier
	prettier,

	// Global ignores
	{
		ignores: [
			'dist/**',
			'node_modules/**',
			'coverage/**',
			'*.config.js',
			'*.config.ts',
			'build/**',
			'.vite/**',
		],
	},

	// TypeScript files configuration (with type-aware linting)
	{
		files: ['src/**/*.{ts,tsx}'],
		ignores: ['**/*.test.{ts,tsx}', '**/tests/**'],
		languageOptions: {
			parser: typescriptParser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
				ecmaFeatures: {
					jsx: true,
				},
				project: './tsconfig.json',
			},
			globals: {
				...globals.browser,
				...globals.node,
				...globals.es2021,
			},
		},
		plugins: {
			'@typescript-eslint': typescript,
			react,
			'react-hooks': reactHooks,
			'react-refresh': reactRefresh,
			import: importPlugin,
		},
		settings: {
			react: {
				version: 'detect',
			},
			'import/resolver': {
				node: {
					extensions: ['.js', '.jsx', '.ts', '.tsx'],
				},
				typescript: {
					alwaysTryTypes: true,
					project: './tsconfig.json',
				},
			},
			'import/parsers': {
				'@typescript-eslint/parser': ['.ts', '.tsx'],
			},
		},
		rules: {
			// TypeScript-specific rules
			...typescript.configs.recommended.rules,
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
				},
			],
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-non-null-assertion': 'error',
			'@typescript-eslint/no-var-requires': 'error',
			'@typescript-eslint/ban-ts-comment': [
				'warn',
				{
					'ts-expect-error': 'allow-with-description',
					'ts-ignore': 'allow-with-description',
					'ts-nocheck': 'allow-with-description',
					'ts-check': false,
				},
			],

			// React rules
			...react.configs.recommended.rules,
			...react.configs['jsx-runtime'].rules,
			'react/react-in-jsx-scope': 'off', // Not needed with React 17+
			'react/prop-types': 'off', // Using TypeScript for prop validation
			'react/display-name': 'off',
			'react/jsx-uses-react': 'off', // Not needed with new JSX transform
			'react/jsx-uses-vars': 'error',
			'react/jsx-key': [
				'error',
				{
					checkFragmentShorthand: true,
					checkKeyMustBeforeSpread: true,
					warnOnDuplicates: true,
				},
			],
			'react/jsx-no-duplicate-props': 'error',
			'react/jsx-no-undef': 'error',
			'react/jsx-no-useless-fragment': 'error',
			'react/jsx-pascal-case': 'error',
			'react/no-array-index-key': 'warn',
			'react/no-children-prop': 'error',
			'react/no-danger': 'warn',
			'react/no-deprecated': 'warn',
			'react/no-direct-mutation-state': 'error',
			'react/no-unescaped-entities': 'error',
			'react/no-unknown-property': 'error',
			'react/self-closing-comp': [
				'error',
				{
					component: true,
					html: true,
				},
			],

			// React Hooks rules
			...reactHooks.configs.recommended.rules,
			'react-hooks/rules-of-hooks': 'error',
			'react-hooks/exhaustive-deps': 'warn',

			// React Refresh
			'react-refresh/only-export-components': [
				'warn',
				{
					allowConstantExport: true,
					allowExportNames: ['default'],
				},
			],

			// General code quality rules
			'no-console': [
				'warn',
				{
					allow: ['warn', 'error'],
				},
			],
			'no-debugger': 'error',
			'no-alert': 'error',
			'no-var': 'error',
			'prefer-const': 'error',
			'prefer-arrow-callback': 'error',
			'prefer-template': 'error',
			'prefer-spread': 'error',
			'prefer-rest-params': 'error',
			'no-eval': 'error',
			'no-implied-eval': 'error',
			'no-new-func': 'error',
			'no-script-url': 'error',
			'no-iterator': 'error',
			'no-proto': 'error',
			'no-return-assign': 'error',
			'no-self-compare': 'error',
			'no-sequences': 'error',
			'no-throw-literal': 'error',
			'no-unmodified-loop-condition': 'error',
			'no-unused-expressions': 'error',
			'no-useless-call': 'error',
			'no-useless-concat': 'error',
			'no-useless-return': 'error',
			'no-void': 'error',
			'no-with': 'error',
			radix: 'error',
			yoda: 'error',

			// Best practices
			'array-callback-return': 'error',
			'consistent-return': 'off', // TypeScript handles this better
			curly: ['error', 'all'],
			'default-case': 'error',
			'default-case-last': 'error',
			'dot-notation': 'error',
			eqeqeq: ['error', 'always', { null: 'ignore' }],
			'no-caller': 'error',
			'no-case-declarations': 'error',
			'no-else-return': ['error', { allowElseIf: false }],
			'no-empty-function': 'off', // TypeScript handles this
			'no-fallthrough': 'error',
			'no-floating-decimal': 'error',
			'no-implicit-coercion': 'error',
			'no-labels': 'error',
			'no-lone-blocks': 'error',
			'no-multi-str': 'error',
			'no-new': 'error',
			'no-new-wrappers': 'error',
			'no-octal-escape': 'error',
			'no-param-reassign': [
				'error',
				{
					props: true,
					ignorePropertyModificationsFor: [
						'state',
						'acc',
						'e',
						'ctx',
						'req',
						'request',
						'res',
						'response',
						'$scope',
					],
				},
			],
			'no-redeclare': 'off', // TypeScript handles this
			'no-return-await': 'error',
			'no-shadow': 'off', // TypeScript handles this better
			'@typescript-eslint/no-shadow': 'error',
			'no-undef-init': 'error',
			'no-undefined': 'off', // TypeScript handles this
			'no-unneeded-ternary': 'error',
			'no-unreachable': 'off', // TypeScript handles this
			'no-unreachable-loop': 'error',
			'no-unsafe-finally': 'error',
			'no-unsafe-negation': 'error',
			'no-use-before-define': 'off', // TypeScript handles this
			'@typescript-eslint/no-use-before-define': [
				'error',
				{
					functions: false,
					classes: true,
					variables: true,
					typedefs: true,
				},
			],
			'require-await': 'off', // TypeScript handles this
			'use-isnan': 'error',
			'valid-typeof': 'error',

			// Import/export rules
			'import/order': [
				'error',
				{
					alphabetize: { order: 'asc', caseInsensitive: true },
					groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
					'newlines-between': 'always',
					pathGroups: [
						{
							pattern: '@/**',
							group: 'internal',
							position: 'before',
						},
					],
					pathGroupsExcludedImportTypes: ['builtin'],
				},
			],
			'import/no-unresolved': 'error',
			'import/no-duplicates': 'error',
			'import/no-cycle': ['error', { maxDepth: 10 }],
			'import/no-self-import': 'error',
			'import/no-useless-path-segments': ['error', { noUselessIndex: true }],
			'import/no-unused-modules': 'off', // Can be slow, enable if needed
			'import/no-deprecated': 'warn',

			// ES6+ features
			'no-duplicate-imports': 'error',
			'no-useless-computed-key': 'error',
			'no-useless-constructor': 'off', // TypeScript handles this
			'no-useless-rename': 'error',
			'object-shorthand': ['error', 'always'],
			'prefer-destructuring': [
				'warn',
				{
					array: false,
					object: true,
				},
				{
					enforceForRenamedProperties: false,
				},
			],
			'prefer-numeric-literals': 'error',
			'prefer-object-spread': 'error',
			'symbol-description': 'error',

			// Barrel file enforcement - all imports must go through barrel files
			// This ensures a clean public API and prevents direct imports from implementation files
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						// UI components - must import from barrel file (block direct imports)
						{
							group: ['**/components/ui/*', '!**/components/ui/index'],
							message:
								'Please import from the barrel file: import { ... } from "@/components/ui"',
						},
						// Layout components - must import from barrel file (block direct imports)
						{
							group: ['**/components/layout/*', '!**/components/layout/index'],
							message:
								'Please import from the barrel file: import { ... } from "@/components/layout"',
						},
						// Icons - must import from barrel file (block direct imports)
						{
							group: ['**/components/icons/*', '!**/components/icons/index'],
							message:
								'Please import from the barrel file: import { ... } from "@/components/icons"',
						},
						// Design system - must import from barrel file (block direct imports)
						{
							group: ['**/design-system/*', '!**/design-system/index'],
							message:
								'Please import from the barrel file: import { ... } from "@/design-system"',
						},
						// Types - must import from barrel file (block direct imports)
						{
							group: ['**/types/*', '!**/types/index'],
							message:
								'Please import from the barrel file: import { ... } from "@/types"',
						},
						// Query hooks - must import from barrel file (block direct imports)
						{
							group: ['**/hooks/queries/*', '!**/hooks/queries/index'],
							message:
								'Please import from the barrel file: import { ... } from "@/hooks/queries"',
						},
						// Stores - must import from barrel file (block direct imports)
						{
							group: ['**/stores/*', '!**/stores/index'],
							message:
								'Please import from the barrel file: import { ... } from "@/stores"',
						},
						// Enforce @/ aliases over relative imports for barrel file directories
						// These patterns match relative imports to barrel file directories at any depth
						{
							group: [
								'../components/ui',
								'../../components/ui',
								'../../../components/ui',
								'../../../../components/ui',
								'../../../../../components/ui',
							],
							message:
								'Please use path alias instead: import { ... } from "@/components/ui"',
						},
						{
							group: [
								'../components/layout',
								'../../components/layout',
								'../../../components/layout',
								'../../../../components/layout',
								'../../../../../components/layout',
							],
							message:
								'Please use path alias instead: import { ... } from "@/components/layout"',
						},
						{
							group: [
								'../components/icons',
								'../../components/icons',
								'../../../components/icons',
								'../../../../components/icons',
								'../../../../../components/icons',
							],
							message:
								'Please use path alias instead: import { ... } from "@/components/icons"',
						},
						{
							group: [
								'../design-system',
								'../../design-system',
								'../../../design-system',
								'../../../../design-system',
								'../../../../../design-system',
							],
							message:
								'Please use path alias instead: import { ... } from "@/design-system"',
						},
						{
							group: [
								'../types',
								'../../types',
								'../../../types',
								'../../../../types',
								'../../../../../types',
							],
							message: 'Please use path alias instead: import { ... } from "@/types"',
						},
						{
							group: [
								'../hooks/queries',
								'../../hooks/queries',
								'../../../hooks/queries',
								'../../../../hooks/queries',
								'../../../../../hooks/queries',
							],
							message:
								'Please use path alias instead: import { ... } from "@/hooks/queries"',
						},
						{
							group: [
								'../stores',
								'../../stores',
								'../../../stores',
								'../../../../stores',
								'../../../../../stores',
							],
							message:
								'Please use path alias instead: import { ... } from "@/stores"',
						},
					],
				},
			],
		},
	},

	// TypeScript test files (without type-aware linting)
	{
		files: ['src/**/*.test.{ts,tsx}', 'src/tests/**/*.{ts,tsx}', 'src/**/testUtils.tsx'],
		languageOptions: {
			parser: typescriptParser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
				ecmaFeatures: {
					jsx: true,
				},
				// No project option for test files
			},
			globals: {
				...globals.browser,
				...globals.node,
				...globals.es2021,
				...globals.jest, // For test globals if using Jest/Vitest
			},
		},
		plugins: {
			'@typescript-eslint': typescript,
			react,
			'react-hooks': reactHooks,
			'react-refresh': reactRefresh,
			import: importPlugin,
		},
		settings: {
			react: {
				version: 'detect',
			},
			'import/resolver': {
				node: {
					extensions: ['.js', '.jsx', '.ts', '.tsx'],
				},
				typescript: {
					alwaysTryTypes: true,
					project: './tsconfig.json',
				},
			},
			'import/parsers': {
				'@typescript-eslint/parser': ['.ts', '.tsx'],
			},
		},
		rules: {
			// Basic TypeScript rules without type-aware ones
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
				},
			],
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-non-null-assertion': 'error',
			// React rules
			...react.configs.recommended.rules,
			...react.configs['jsx-runtime'].rules,
			'react/react-in-jsx-scope': 'off',
			'react/prop-types': 'off',
			'react/display-name': 'off',
			'react/jsx-uses-react': 'off',
			'react/jsx-uses-vars': 'error',
			'react/jsx-key': 'error',
			'react/jsx-no-duplicate-props': 'error',
			'react/jsx-no-undef': 'error',
			'react/jsx-no-useless-fragment': 'error',
			'react/jsx-pascal-case': 'error',
			'react/no-array-index-key': 'warn',
			'react/no-children-prop': 'error',
			'react/no-danger': 'warn',
			'react/no-deprecated': 'warn',
			'react/no-direct-mutation-state': 'error',
			'react/no-unescaped-entities': 'error',
			'react/no-unknown-property': 'error',
			'react/self-closing-comp': 'error',
			// React Hooks
			...reactHooks.configs.recommended.rules,
			'react-hooks/rules-of-hooks': 'error',
			'react-hooks/exhaustive-deps': 'warn',
			// React Refresh
			'react-refresh/only-export-components': [
				'warn',
				{
					allowConstantExport: true,
					allowExportNames: ['default'],
				},
			],
			// General rules (same as main config but without type-aware ones)
			'no-console': [
				'warn',
				{
					allow: ['warn', 'error'],
				},
			],
			'no-debugger': 'error',
			'no-var': 'error',
			'prefer-const': 'error',
		},
	},

	// JavaScript files (if any)
	{
		files: ['**/*.{js,jsx}'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			parserOptions: {
				ecmaFeatures: {
					jsx: true,
				},
			},
			globals: {
				...globals.browser,
				...globals.node,
				...globals.es2021,
			},
		},
		plugins: {
			react,
			'react-hooks': reactHooks,
			'react-refresh': reactRefresh,
			import: importPlugin,
		},
		settings: {
			react: {
				version: 'detect',
			},
		},
		rules: {
			...react.configs.recommended.rules,
			...react.configs['jsx-runtime'].rules,
			...reactHooks.configs.recommended.rules,
			'react/react-in-jsx-scope': 'off',
			'react/prop-types': 'off',
			'react-refresh/only-export-components': [
				'warn',
				{
					allowConstantExport: true,
				},
			],
		},
	},
]
