import type { KnipConfig } from 'knip'

const config: KnipConfig = {
	ignoreExportsUsedInFile: true, // Allow exports that are only used in the same file

	entry: ['src/main.tsx'],
	project: ['src/**/*.{ts,tsx}'],

	ignore: [
		'**/*.d.ts',
		'**/*.stories.{ts,tsx}', // Storybook story files

		// Test files - dependencies used in tests are valid
		'src/tests/**/*.{ts,tsx}',

		// Exclude server files (they're analyzed separately)
		'../src/**/*',

		// GitHub workflows - they use binaries that aren't part of the codebase
		'../.github/**/*',

		// Design system public API - exported for external use as design system is built
		'src/design-system/**/*.ts',

		// Type definitions that are part of public API
		'src/types/**/*.ts',

		// Test helpers (may be referenced only in test runs)
		'src/tests/helpers/**',

		// ============================================================================
		// BARREL FILES - PUBLIC API (IGNORE COMPLETELY)
		// ============================================================================
		// These are the public API entry points. Their exports are meant to be
		// available for consumers, even if not directly imported. This is the
		// documented API surface, not "unused code".
		'src/components/ui/index.ts',
		'src/components/layout/index.ts',
		'src/hooks/queries/index.ts',
		'src/stores/index.ts',

		// ============================================================================
		// COMPONENT IMPLEMENTATION FILES - INTERNAL DETAILS (IGNORE)
		// ============================================================================
		// These files export types that are re-exported via barrel files.
		// They are implementation details - only the barrel files are the public API.
		// We ignore them to avoid false positives about "unused" exports that are
		// actually consumed via barrel file re-exports.
		'src/components/ui/Avatar.tsx',
		'src/components/ui/Badge.tsx',
		'src/components/ui/Button.tsx',
		'src/components/ui/Card.tsx',
		'src/components/ui/Input.tsx',
		'src/components/ui/Select.tsx',
		'src/components/ui/Textarea.tsx',
		'src/components/ui/ToggleGroup.tsx',
		'src/components/layout/Container.tsx',
		'src/components/layout/Grid.tsx',
		'src/components/layout/PageLayout.tsx',
		'src/components/layout/Section.tsx',
		'src/components/layout/Stack.tsx',

		// ============================================================================
		// PUBLIC API TYPES - USEFUL FOR TYPING BUT NOT DIRECTLY IMPORTED
		// ============================================================================
		// These types are part of the public API and useful for consumers to type
		// their variables, even if they're not directly imported (TypeScript infers
		// them from function return types, etc.)
		'src/hooks/queries/search.ts', // EventSearchResponse, EventSearchFilters
		'src/lib/seo.ts', // SEOMetadata
	],

	// Reinclude barrel files in treeshaking analysis
	// This ensures we can still detect if a component itself is unused
	includeEntryExports: true,

	// Ignore dependency issues in test files (dependencies are valid in tests)
	ignoreIssues: {
		'src/tests/**/*.{ts,tsx}': ['dependencies'],
	},
}

export default config
