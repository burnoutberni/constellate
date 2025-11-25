# Stellar Calendar

A federated event management platform implementing the ActivityPub protocol for decentralized event sharing and discovery across multiple instances.

## Features

- 📅 **Event Management**: Create, update, and delete events with rich metadata
- 🌐 **Federation**: ActivityPub protocol implementation for cross-instance communication
- 👥 **Social Features**: Follow users, RSVP to events, like/bookmark, and comment
- ⚡ **Real-time Updates**: Server-Sent Events (SSE) for live synchronization
- 🎨 **Modern UI**: React + Tailwind CSS with vibrant, premium design
- 🔒 **Security**: HTTP Signatures, SSRF protection, rate limiting
- 📱 **Responsive**: Mobile-first design with accessibility support
- 📤 **Calendar Export**: ICS file generation for calendar apps

## Technology Stack

### Backend
- **Runtime**: Node.js with Hono framework
- **Database**: SQLite (dev) / PostgreSQL (prod) with Prisma ORM
- **Authentication**: better-auth
- **Federation**: Custom ActivityPub implementation
- **Validation**: Zod schemas
- **Calendar**: ical-generator

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router
- **Real-time**: Server-Sent Events (SSE)

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd stellar-calendar

# Install backend dependencies
npm install

# Install frontend dependencies
cd client && npm install && cd ..

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Set up database
npx prisma generate
npx prisma db push
npx prisma db seed
```

### Development

```bash
# Terminal 1: Start backend server
npm run dev

# Terminal 2: Start frontend dev server
cd client && npm run dev
```

The backend will run on `http://localhost:3000` and the frontend on `http://localhost:5173`.

## Federation Testing

Test federation with two local instances using Docker:

```bash
# Start two instances
npm run dev:federation

# Access instances
# Instance 1: http://app1.local
# Instance 2: http://app2.local

# Stop instances
npm run dev:federation:down
```

## Project Structure

```
stellar-calendar/
├── src/                      # Backend source
│   ├── server.ts            # Main entry point
│   ├── activitypub.ts       # ActivityPub endpoints
│   ├── events.ts            # Event management
│   ├── lib/                 # Shared libraries
│   ├── services/            # Business logic
│   └── constants/           # Constants
├── client/                   # Frontend source
│   ├── src/
│   │   ├── pages/          # React pages
│   │   ├── components/     # React components
│   │   └── hooks/          # Custom hooks
│   └── public/             # Static assets
├── prisma/                   # Database schema
└── tests/                    # Test files
```

## API Endpoints

### ActivityPub
- `GET /.well-known/webfinger` - WebFinger discovery
- `GET /users/:username` - Actor object
- `GET /users/:username/followers` - Followers collection
- `GET /users/:username/following` - Following collection
- `GET /users/:username/outbox` - Outbox collection
- `POST /users/:username/inbox` - Personal inbox
- `POST /inbox` - Shared inbox
- `GET /events/:id` - Event as ActivityPub object

### REST API
- `POST /api/events` - Create event
- `GET /api/events` - List events
- `GET /api/events/:id` - Get event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event
- `POST /api/events/:id/attend` - RSVP to event
- `POST /api/events/:id/like` - Like event
- `POST /api/events/:id/comments` - Comment on event

## Testing

```bash
# Run all tests
npm run test:all

# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## Development Guide

See [DEVELOPMENT.md](./DEVELOPMENT.md) for architecture details and development guidelines.

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.
