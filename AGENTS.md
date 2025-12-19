# Agent Guidelines for Constellate

## Commands

- **Run Tests:** Run them in the correct directory for our backend (`/`) and frontend (`/client`) codebase.
    - **All tests (Backend):** From root directory: `npm test` (all backend tests) | `npm run test:watch` (with coverage and watch) | `npm run test:coverage` (with coverage)
    - **All tests (Frontend):** From `/client` directory: `npm test` (all frontend tests) | `npm run test:watch` (watch mode) | `npm run test:coverage` (with coverage) | `npm run test:storybook` (Storybook tests)
    - **All tests (Both):** Run `npm test` in both root and `/client` directories to run all backend and frontend tests
    - **Single test (Server):** From the root directory, run `npm test -- src/path/to/test.ts`
    - **Single test (Client):** From the `/client` directory, run `npm test -- src/path/to/test.ts`
- **Check:** `npm run check` (lint, typecheck, knip for server & client) | **Check:Server:** `npm run check:server` | **Check:Client:** `npm run check:client`
- **Lint:** `npm run lint` (for both) | `npm run lint:server` | `npm run lint:client`
- **Typecheck:** `npm run typecheck` (for both) | `npm run typecheck:server` | `npm run typecheck:client`
- **Analyze (Knip):** `npm run knip` (for both) | `npm run knip:server` | `npm run knip:client`
- **Format:** `npm run format` (Prettier for both) (ALWAYS RUN BEFORE COMMITTING!)
- **Build:** `npm run build` (builds server & client) | **DB:** `npm run db:push` (Prisma)
- **Start:** `npm run dev` (Server+Client)

## Code Style & Conventions

- **Stack:** Node.js/Hono (Backend), React/Vite/Tailwind (Frontend), Prisma (ORM).
- **Imports (Server):** MUST use `.js` extension for local imports (e.g., `from './auth.js'`).
- **Imports (Client):** Do NOT use extensions for imports.
- **Formatting:** No semicolons. Single quotes preferred. Run `npm run format` to fix, ALWAYS RUN BEFORE COMMITTING!
- **TypeScript:** Strict mode enabled. Use explicit types for exports/public APIs.
- **Naming:** `camelCase` for variables/functions. `PascalCase` for React components.
- **Error Handling:** Use `try/catch`. On server, use `handleError` from `lib/errors.js`.
- **Testing:** Write tests in `src/tests/` for server code or co-located with components in `client/src/` for client code. Use `vi` from Vitest. Run all tests with `npm test`, or target specific files as noted above.
- **Structure:** `client/` is the frontend. `src/` is the backend.

## Frontend Changes

If you make frontend changes, always update our Storybook accordingly. This means, adding new stories for new components, removing old stories if we remove components or updating existing stories if we update components.

Add new test if we add new components, remove old tests if we remove components or update existing tests if we update components. All frontend tests need to be "good" tests:

✅ Good tests:
“User can submit a form and see success”
“Invalid input shows an error”
“Keyboard navigation works”
“Loading state appears and disappears”
“Error fallback renders”

🚫 Bad tests:
“State variable X equals Y”
“Hook returns Z”
Snapshot tests of large trees
Testing internal component structure

## Backend Changes

Add new test if we add new backend code, remove old tests if we remove the tested backend code or update existing tests if we update backend code. All API endpoints need to be documented in our OpenAPI/Scalar docs (`src/openapi.json`).
