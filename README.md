# Constellate

A federated event management platform implementing the ActivityPub protocol for decentralized event sharing and discovery across multiple instances.

**Status: Public Beta** - The project is ready for beta testing. See deployment section for production setup.

## Features

- **Event sharing & reposts**: Share any public event (local or remote) with your followers. Shares are federated using ActivityPub `Announce` activities, appear in the activity feed with attribution, and include a dedicated share action on the event detail page.

## Advanced Event Search (WP-011)

Constellate now ships with a dedicated `/search` experience and richer backend filtering so community members can zero in on the events that matter most.

- **Filter UI:** The new `SearchPage` pairs keyword search with location filters, attendance mode/status toggles, tag/category chips, and both preset and custom date ranges. All filters sync to the URL, making searches easy to share.
- **API updates:** `GET /api/search` accepts the following query parameters (all optional):
  - `q` — keyword (title/summary)
  - `location` — case-insensitive substring match
  - `dateRange` — one of `today`, `tomorrow`, `this_weekend`, `next_7_days`, `next_30_days`
  - `startDate` / `endDate` — ISO timestamps for custom ranges (leave `dateRange` unset to rely exclusively on explicit bounds)
  - `mode` — `OfflineEventAttendanceMode`, `OnlineEventAttendanceMode`, or `MixedEventAttendanceMode`
  - `status` — `EventScheduled`, `EventPostponed`, `EventCancelled`
  - `categories` or `tags` — comma-separated list of normalized tags (aliases are treated interchangeably)
  - `username` — filter by organizer handle
  - `page` / `limit` — pagination controls (limit capped at 100)
- **Preset handling:** When `dateRange` is provided and explicit dates are omitted, the backend now expands the preset into start/end boundaries (e.g., `next_7_days` resolves to “today through six days from now”) while still respecting visibility constraints.
- **Documentation-first:** Filters are echoed back under `filters` in the JSON payload so clients can display applied chips without re-parsing URLs.

## User Mentions in Comments

Constellate comments now understand `@username` mentions:

- Backend automatically parses sanitized comment text, stores structured mention metadata, and broadcasts a `mention:received` SSE event to the mentioned local user (remote users are skipped until federation notifications land).
- POST `/api/events/:id/comments` accepts an optional `inReplyToId` and returns each comment's `mentions` array so clients can render contextual links.
- New `CommentMention` entries power future notification history while keeping API responses lightweight.
- The web client adds mention autocomplete (type `@` to search local users), inline highlighting, and real-time mention toasts in the bottom-right corner so people notice when they're called out.

## Timezone Handling (WP-017)

- **User preference:** Every account now has a stored IANA timezone (defaults to `UTC`). Update it from `/settings`, where the UI pulls from the platform-supported timezone list and persists via `PUT /api/profile`.
- **Event metadata:** Newly created and shared events automatically capture the creator's timezone so other viewers know where the times originate. Event detail pages render times in the viewer's preferred/device timezone and call out the source timezone for clarity.
- **Calendar exports:** All `.ics` exports embed the correct `VTIMEZONE` definitions and tag each event with `TZID`, so calendar clients convert to the subscriber's locale without losing the original schedule.

## Event Reminders (WP-015)

- RSVP flows now include a reminder selector (Going/Maybe only). Supported offsets: 5, 15, 30, 60, 120 minutes and 24 hours before start.
- API endpoints:
  - `GET /api/events/:eventId/reminders` — returns the viewer's reminder plus the allowed offsets.
  - `POST /api/events/:eventId/reminders` — sets or updates the reminder (`{ "minutesBeforeStart": 30 }`).
  - `DELETE /api/events/:eventId/reminders` or `DELETE /api/events/:eventId/reminders/:reminderId` — cancels reminders.
- RSVP payloads accept an optional `reminderMinutesBeforeStart` field so the frontend can create reminders in the same request as an attendance change.
- `src/services/reminderDispatcher.ts` runs every ~30 seconds (in non-test environments) to pick up reminders whose `remindAt` timestamp passed, emit in-app notifications, and send emails via `src/lib/email.ts` when SMTP is configured.

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

## Follow System

Constellate supports following users to build a personalized activity feed. The follow system integrates with ActivityPub for federated follows across instances:

- `POST /api/users/:username/follow` — follow a user (local or remote)
- `DELETE /api/users/:username/follow` — unfollow a user
- `GET /api/users/:username/follow-status` — check if you're following a user
- `GET /api/activity/feed` — get activities from users you follow

Features:
- **Auto-accept**: Users can configure whether to automatically accept follow requests
- **Pending follows**: Follow requests to users with auto-accept disabled appear as "Pending"
- **ActivityPub integration**: Following remote users sends ActivityPub Follow activities
- **Activity feed**: See events, likes, RSVPs, and comments from people you follow
- **Real-time updates**: Follow status changes are broadcast via SSE (`follow:pending`, `follow:accepted`, etc.)

## Notifications API

Constellate ships with a backend notification service that powers both the REST API and real-time delivery channel:

- `GET /api/notifications?limit=20` — returns the most recent notifications plus the unread count.
- `POST /api/notifications/:notificationId/read` — marks a single notification as read.
- `POST /api/notifications/mark-all-read` — marks all notifications for the authenticated user as read.

Notifications are streamed in real time over the existing SSE endpoint as `notification:created` events, so the frontend can immediately surface unread counts without polling.

## Notification UI (WP-009)

- The client now includes a `NotificationBell` component (`client/src/components/NotificationBell.tsx`) that surfaces unread counts in the navbar, streams updates via `notification:created` / `notification:read` SSE events, and exposes quick actions (mark all read, jump to details).
- A dedicated `/notifications` page (`client/src/pages/NotificationsPage.tsx`) presents the full inbox with type-specific styling (follow, comment, like, mention, event, system), actor context, and contextual navigation buttons.
- Both surfaces are powered by the same React Query hooks (`client/src/hooks/queries/notifications.ts`) which wrap the REST endpoints above and keep the cache synchronized with SSE broadcasts for real-time UI updates.
- When linking notifications to product experiences, populate `contextUrl` on the backend — the UI will navigate internally for relative URLs or fall back to `window.location` for absolute links.

## Event Recommendations (WP-013)

Constellate now suggests events tailored to each signed-in member's interests:

- `GET /api/recommendations?limit=6` returns a scored list of events the viewer can access, along with reasons (matching tags, followed hosts, popularity) and lightweight signal metadata. The endpoint requires authentication and respects the same visibility rules as the events feed.
- Recommendations combine recently attended or liked events, preferred organizers, followed ActivityPub actors, and current engagement signals (attendance, likes, comments, recency).
- The Home page and Feed sidebar display a "Recommended for you" card when a user is signed in. Each card surfaces the top reason and links directly to the detailed event view.
- When no personal signals exist yet, the service automatically falls back to trending upcoming public events so the UI still has meaningful suggestions.

## Trending Events (WP-012)

- `GET /api/events/trending?limit=10&windowDays=7` surfaces the most engaged events from the recent window. Each response contains the trending window, generation timestamp, and an array of events annotated with `trendingScore`, `trendingRank`, and a `trendingMetrics` breakdown (likes, comments, RSVPs).
- Scores weight engagement (likes ×4, comments ×5, attendance ×3) and apply a decay/boost curve so upcoming and freshly updated events outrank stale listings. Only events with real engagement are returned, and standard visibility rules still apply.
- The feed page now exposes Activity / Trending tabs; the Trending tab shows the hottest events with live metrics, visibility badges, tag chips, and a manual refresh control that re-runs the algorithm on demand.

## License

AGPL-3.0

## Recurring Events

Constellate now supports recurring events for daily, weekly, and monthly schedules. When creating or updating an event via `POST /api/events` or `PUT /api/events/:id`, include the following fields:

- `recurrencePattern`: one of `DAILY`, `WEEKLY`, or `MONTHLY`
- `recurrenceEndDate`: ISO timestamp that indicates when the recurrence should stop

Recurring events automatically expand on calendar views and are exported with RRULE metadata in iCal feeds.

## Calendar Sync (WP-016)

- iCal exports include canonical event URLs inside the description so calendar clients always preserve a link back to Constellate.
- `GET /api/calendar/{id}/export/google` returns a ready-to-open Google Calendar link for any event, respecting the same visibility rules as iCal downloads.
- The Calendar page now adds a per-event **Add to Google Calendar** action inside the Upcoming Events list so users can quickly push upcoming happenings to their personal calendar.
