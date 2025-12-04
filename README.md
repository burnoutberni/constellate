# Constellate

A federated event management platform implementing the ActivityPub protocol for decentralized event sharing and discovery across multiple instances.

**Status: Public Beta** - The project is ready for beta testing. See deployment section for production setup.

<<<<<<< HEAD
## Event Templates

Event creators can now save reusable templates that capture the full event configuration (title, summary, location, URLs, timing, etc.). Templates live under the authenticated user's account and can be selected directly in the event creation modal to prefill the form.

- `GET /api/event-templates` – list the authenticated user's templates
- `POST /api/event-templates` – create a new template (send `name`, optional `description`, and `data` that mirrors the event payload)
- `GET /api/event-templates/:id` – fetch a specific template
- `PUT /api/event-templates/:id` – update template metadata or data
- `DELETE /api/event-templates/:id` – remove a template

All endpoints require an authenticated session cookie. See `src/openapi.json` for the full schema.
=======
## Event Visibility Levels

Constellate now supports granular audience controls on events. When creating or editing an event you can choose one of four `visibility` levels:

- **`PUBLIC`** – indexed everywhere and federated to the public collection.
- **`FOLLOWERS`** – delivered only to followers of the event organizer.
- **`UNLISTED`** – accessible via direct link but hidden from feeds and searches.
- **`PRIVATE`** – visible only to the organizer.

Expose the chosen level via the `visibility` field in the Events API (see OpenAPI docs) or the “Visibility” selector in the Create Event dialog.
>>>>>>> 4b8b7b7 (Add event visibility controls across stack)

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

```bash
# Run tests once
npm test

# Watch mode (run in separate terminal from dev servers)
npm run test:watch

# Run all test suites
npm run test:all
```

## License

AGPL-3.0
