# Constellate

A federated event management platform implementing the ActivityPub protocol for decentralized event sharing and discovery across multiple instances.

**Status: Public Beta**

## Features

- **Event Management**: Create, share, and discover events with full ActivityPub federation
- **Advanced Search**: Filter by location, date, tags, attendance mode, and organizer
- **User Mentions**: `@username` mentions in comments with real-time notifications
- **Timezone Support**: User timezone preferences with proper calendar export handling
- **Event Reminders**: Configurable reminders for RSVP'd events
- **Follow System**: Follow users and build personalized activity feeds
- **Notifications**: Real-time in-app notifications via SSE
- **Event Recommendations**: Personalized event suggestions based on interests
- **Trending Events**: Algorithm-based trending events with engagement metrics
- **Recurring Events**: Support for daily, weekly, and monthly recurring schedules
- **Calendar Sync**: iCal exports and Google Calendar integration
- **Location Discovery**: Nearby event search with OpenStreetMap integration
- **Instance Directory**: Discover and explore federated instances

## Development

### Using Docker (Recommended)

```bash
# Start development server (Terminal 1)
npm run docker:dev

# Start test watcher in separate terminal (Terminal 2)
npm run docker:test
```

The dev environment starts two instances (app1 and app2) at `http://app1.local` and `http://app2.local`. Add these domains to your hosts file: `127.0.0.1 app1.local app2.local test.local`.

### Local Development

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Set up PostgreSQL database
createdb constellate_dev
export DATABASE_URL="postgresql://user:password@localhost:5432/constellate_dev?schema=public"

# Set up database
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed

# Start development servers (Terminal 1)
npm run dev

# Start test watcher in separate terminal (Terminal 2)
npm run test:watch
```

## Production

### Docker Deployment

```bash
npm run docker:prod
```

### Required Environment Variables

```bash
# Server Configuration
NODE_ENV=production
PORT=3000
BETTER_AUTH_URL=https://yourdomain.com
BETTER_AUTH_SECRET=<generate-with-openssl-rand-hex-32>
BETTER_AUTH_TRUSTED_ORIGINS=https://yourdomain.com
CORS_ORIGINS=https://yourdomain.com

# Database
DATABASE_URL=postgresql://user:password@db:5432/constellate?schema=public
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=constellate

# Encryption (for private keys)
ENCRYPTION_KEY=<generate-with-openssl-rand-hex-32>
```

**Important Notes:**

- Rate limiting is in-memory only (single-instance). Use Redis for multi-instance deployments.
- Update `Caddyfile.prod` with your domain before deployment.
- Migrations run automatically on container startup.

## Testing

Tests run against an in-memory Prisma mock, no database required:

```bash
# Run test suite with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Run tests
npm test
```

## ActivityPub Federation

Constellate implements ActivityPub for federation with compatible instances (Mastodon, Mobilizon, etc.). Supported activities:

- **Outgoing**: Create, Update, Delete, Follow, Accept, Reject, Like, Announce, TentativeAccept, Undo
- **Incoming**: All activity types are processed and cached locally
- **Features**: HTTP signatures, WebFinger discovery, shared inboxes, real-time SSE updates

See `src/activitypub.ts`, `src/federation.ts`, and `src/services/ActivityBuilder.ts` for implementation details.

## API Endpoints

Key endpoints:

- **Events**: `GET /api/events`, `POST /api/events`, `GET /api/events/:id`, `GET /api/events/trending`
- **Search**: `GET /api/search` (with filters), `GET /api/search/nearby`
- **Users**: `POST /api/users/:username/follow`, `GET /api/activity/feed`
- **Notifications**: `GET /api/notifications`, `POST /api/notifications/:id/read`
- **Reminders**: `GET /api/events/:id/reminders`, `POST /api/events/:id/reminders`
- **Instances**: `GET /api/instances`, `GET /api/instances/search`

## To-Do

### High Priority

- [ ] Implement Redis-based rate limiting for multi-instance deployments (currently in-memory only)
- [ ] Implement missing backend endpoints:
    - [ ] `PUT /api/notifications/preferences` - Notification preferences saving
    - [ ] `DELETE /api/profile` - Account deletion endpoint
- [ ] Replace remaining direct `fetch()` call in `CalendarPage.tsx` (line 189) with API client

### Medium Priority

- [ ] Consider React Hook Form + Zod for form validation
- [ ] Run accessibility audit (axe-core, keyboard navigation, screen readers)
- [ ] Performance optimization (bundle analysis, code splitting, lazy loading)
- [ ] Design system improvements:
    - [ ] Add more semantic color variants
    - [ ] Expand typography scale
    - [ ] Add animation tokens
    - [ ] Add component-specific tokens
    - [ ] Create Storybook documentation site
- [ ] Add pre-commit git hooks (lint-staged/husky) for linting and formatting
- [ ] Add bundle size monitoring to CI/CD to prevent regressions
- [ ] Add automated accessibility checks (axe-core) to GitHub Actions workflow

### Low Priority

- [ ] Add JSDoc comments and component documentation (partial - some components have docs)
- [ ] Add integration and E2E tests for critical paths (Playwright/Cypress setup)
- [ ] Enforce import organization with ESLint
- [ ] Centralize and type-safe environment variables (backend has config.ts, frontend needs it)
- [ ] Detect and eliminate code duplication
- [ ] Set up dependency management automation
- [ ] Set up error tracking and monitoring
- [ ] Extend API client to handle blob responses (for `.ics` file downloads)
- [ ] Add coverage threshold enforcement in CI (minimum coverage requirements)
- [ ] Add dependency security scanning (`npm audit` or Snyk) to CI

## License

AGPL-3.0
