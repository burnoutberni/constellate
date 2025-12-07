# Constellate

A federated event management platform implementing the ActivityPub protocol for decentralized event sharing and discovery across multiple instances.

**Status: Public Beta** - The project is ready for beta testing. See deployment section for production setup.

## User Mentions in Comments

Constellate comments now understand `@username` mentions:

- Backend automatically parses sanitized comment text, stores structured mention metadata, and broadcasts a `mention:received` SSE event to the mentioned local user (remote users are skipped until federation notifications land).
- POST `/api/events/:id/comments` accepts an optional `inReplyToId` and returns each comment's `mentions` array so clients can render contextual links.
- New `CommentMention` entries power future notification history while keeping API responses lightweight.
- The web client adds mention autocomplete (type `@` to search local users), inline highlighting, and real-time mention toasts in the bottom-right corner so people notice when they're called out.

## Development

### Using Docker (Recommended)

```bash
# Start development server (Terminal 1)
npm run docker:dev

# Start test watcher in separate terminal (Terminal 2)
npm run docker:test
```

The dev environment starts two instances (app1 and app2) that watch all frontend and backend code changes. Both are served by Caddy at `http://app1.local` and `http://app2.local`. Each instance runs both backend and frontend; the frontend proxies API requests to the backend. Add these domains to your hosts file: `app1.local`, `app2.local`, and `test.local`. Edit `/etc/hosts` and add `127.0.0.1 app1.local app2.local test.local`. The test watcher monitors source code changes and runs tests automatically.

**Database:** Docker development uses PostgreSQL (consistent with production). Migrations are created and applied automatically on first startup.

### Local Development

**Option 1: Using PostgreSQL (Recommended, consistent with production)**

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Set up PostgreSQL database (make sure PostgreSQL is running)
# Create database: createdb constellate_dev
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
# Build and start production containers
npm run docker:prod
```

### Required Environment Variables

Create a `.env` file with the following variables:

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

1. **Rate Limiting**: The current implementation uses in-memory rate limiting, which only works for single-instance deployments. For multi-instance deployments, you MUST implement Redis-based rate limiting (see `src/middleware/rateLimit.ts` for details).

2. **Caddy Configuration**: Update `Caddyfile.prod` with your actual domain and email before deployment.

3. **Database Migrations**: Migrations run automatically on container startup via `scripts/prod-entrypoint.sh`. Always create migrations when changing the database schema using `npx prisma migrate dev --name your_change_name`.

4. **Security**: Ensure all secrets are properly generated and stored securely. Never commit `.env` files to version control.

## Testing

Testing runs entirely against an in-memory Prisma mock (via `@pkgverse/prismock`), so no local database or Docker services are required. Just install dependencies with `npm install` (and `npm install` inside `client/` when touching frontend code) and use the scripts below:

```bash
# Run deterministic Vitest suite with coverage + JUnit (reports/junit.xml)
npm run test:coverage

# Watch mode (run in separate terminal from dev servers)
npm run test:watch

# Run test suite
npm test
```

The mocked data layer resets between tests, so suites remain isolated without needing to truncate tables or run migrations.

## Notifications API

Constellate now ships with a backend notification service that powers both the REST API and real-time delivery channel:

- `GET /api/notifications?limit=20` — returns the most recent notifications plus the unread count.
- `POST /api/notifications/:notificationId/read` — marks a single notification as read.
- `POST /api/notifications/mark-all-read` — marks all notifications for the authenticated user as read.

Notifications are streamed in real time over the existing SSE endpoint as `notification:created` events, so the frontend can immediately surface unread counts without polling.

## License

AGPL-3.0

## Recurring Events

Constellate now supports recurring events for daily, weekly, and monthly schedules. When creating or updating an event via `POST /api/events` or `PUT /api/events/:id`, include the following fields:

- `recurrencePattern`: one of `DAILY`, `WEEKLY`, or `MONTHLY`
- `recurrenceEndDate`: ISO timestamp that indicates when the recurrence should stop

Recurring events automatically expand on calendar views and are exported with RRULE metadata in iCal feeds.
