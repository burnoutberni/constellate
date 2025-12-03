import type { KnipConfig } from 'knip';

const config: KnipConfig = {
    entry: ['src/server.ts', 'scripts/**/*.ts', 'prisma/seed.ts'],
    project: ['src/**/*.ts', 'scripts/**/*.ts'],
    ignore: [
        '**/*.d.ts', 
        'src/tests/**/*.ts',
        // Public API types that may be used externally (ActivityPub types, Session type)
        'src/lib/activitypubSchemas.ts',
        'src/auth.ts',
        'src/constants/activitypub.ts',
    ],
    ignoreDependencies: [
        'ts-node', 
        'nodemon', 
        'eslint-config-love',
        // Client ESLint plugins - root ESLint config handles client files
        '@typescript-eslint/eslint-plugin',
        '@typescript-eslint/parser',
        'eslint-plugin-react-hooks',
        'eslint-plugin-react-refresh',
    ],
    ignoreExportsUsedInFile: true, // Allow exports that are only used in the same file
    workspaces: {
        'client': {
            entry: ['index.html', 'src/main.tsx'],
            project: ['src/**/*.{ts,tsx}'],
            ignore: ['**/*.d.ts'],
        }
    }
};

export default config;
