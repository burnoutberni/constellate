# Constellate

A federated event management platform implementing the ActivityPub protocol for decentralized event sharing and discovery across multiple instances.

**Status: Public Alpha**

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
BETTER_AUTH_SECRET_FILE=/run/secrets/better_auth_secret
BETTER_AUTH_TRUSTED_ORIGINS=https://yourdomain.com
CORS_ORIGINS=https://yourdomain.com

# Database
# In production with Docker Secrets, DATABASE_URL is constructed automatically.
# Just set POSTGRES_USER, POSTGRES_DB and use POSTGRES_PASSWORD_FILE.
POSTGRES_USER=postgres
POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password
POSTGRES_DB=constellate

# Encryption (for private keys)
ENCRYPTION_KEY_FILE=/run/secrets/encryption_key

# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=user@example.com
SMTP_PASS_FILE=/run/secrets/smtp_pass
SMTP_FROM=noreply@example.com
```

### Docker Secrets (Recommended for Production)

For improved security in production, we use Docker Secrets instead of environment variables for sensitive values (`SMTP_PASS`, `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`).

1.  Create a `secrets` directory in your project root (or wherever you run docker-compose).
2.  Create files for each secret containing the value (e.g., `secrets/smtp_pass`, `secrets/better_auth_secret`).
3.  The `docker-compose.prod.yml` is already configured to mount these secrets.
4.  Set the `*_FILE` environment variables to point to the mounted secrets in `/run/secrets/`.

Example `secrets` directory structure:

```
secrets/
  better_auth_secret
  encryption_key
  smtp_pass
  postgres_password
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

## License

AGPL-3.0
