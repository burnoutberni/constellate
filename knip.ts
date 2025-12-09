import type { KnipConfig } from 'knip';

const config: KnipConfig = {
    ignoreExportsUsedInFile: true, // Allow exports that are only used in the same file
    workspaces: {
        '.': {
            entry: ['src/server.ts', 'prisma/seed.ts'],
            project: ['src/**/*.ts'],
            ignore: [
                '**/*.d.ts', 
                'src/tests/**/*.ts',
                // Public API types that may be used externally (ActivityPub types, Session type)
                'src/lib/activitypubSchemas.ts',
                'src/auth.ts',
                'src/constants/activitypub.ts',
            ],
            ignoreDependencies: [
                'eslint-config-love',
            ],
        },
        'client': {
            entry: ['index.html', 'src/main.tsx'],
            project: ['src/**/*.{ts,tsx}'],
            ignore: [
                '**/*.d.ts',
                // Design system public API - exported for external use as design system is built
                'src/design-system/**/*.ts',
                // UI component types - exported as public API for TypeScript consumers
                'src/components/ui/**/*.tsx',
                // Type definitions that are part of public API
                'src/types/**/*.ts',
                'src/hooks/queries/search.ts',
            ],
            ignoreDependencies: [
                // ESLint plugins are used by root ESLint config
                '@typescript-eslint/eslint-plugin',
                '@typescript-eslint/parser',
                'eslint-plugin-react-hooks',
                'eslint-plugin-react-refresh',
            ],
        }
    }
};

export default config;
