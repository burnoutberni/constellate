# Agent Guidelines for Constellate

## Commands

- **Run Tests:** `npm test` (or `vitest run`). Single: `vitest run src/path/to/test.ts`
- **Lint:** `npm run lint` | **Format:** `npm run format` (Prettier)
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
- **Testing:** Write tests in `src/tests/` (server) or co-located (client). Use `vi` from Vitest.
- **Structure:** `client/` is the frontend. `src/` is the backend.
