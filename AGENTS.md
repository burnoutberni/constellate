# Agent Guidelines for Constellate

## Commands

- **Run Tests:** `npm test` (all tests) | `npm run test:watch` (with coverage and watch) | `npm run test:coverage` (with coverage). Single: `vitest run src/path/to/test.ts` (server) or `vitest run client/src/path/to/test.ts` (client)
- **Check:** `npm run check` (lint, typecheck, knip for server & client) | **Check:Server:** `npm run check:server` | **Check:Client:** `npm run check:client`
- **Lint:** `npm run lint` (for both) | `npm run lint:server` | `npm run lint:client`
- **Typecheck:** `npm run typecheck` (for both) | `npm run typecheck:server` | `npm run typecheck:client`
- **Analyze (Knip):** `npm run knip` (for both) | `npm run knip:server` | `npm run knip:client`
- **Format:** `npm run format` (Prettier for both)
- **Build:** `npm run build` (builds server & client) | **DB:** `npm run db:push` (Prisma)
- **Start:** `npm run dev:app` (Server+Client)

## Code Style & Conventions

- **Stack:** Node.js/Hono (Backend), React/Vite/Tailwind (Frontend), Prisma (ORM).
- **Imports (Server):** MUST use `.js` extension for local imports (e.g., `from './auth.js'`).
- **Imports (Client):** Do NOT use extensions for imports.
- **Formatting:** No semicolons. Single quotes preferred. Run `npm run format` to fix.
- **TypeScript:** Strict mode enabled. Use explicit types for exports/public APIs.
- **Naming:** `camelCase` for variables/functions. `PascalCase` for React components.
- **Error Handling:** Use `try/catch`. On server, use `handleError` from `lib/errors.js`.
- **Testing:** Write tests in `src/tests/` for server code or co-located with components in `client/src/` for client code. Use `vi` from Vitest. Run all tests with `npm test`, or target specific files as noted above.
- **Structure:** `client/` is the frontend. `src/` is the backend.
