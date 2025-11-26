# Stellar Calendar

A federated event management platform implementing the ActivityPub protocol for decentralized event sharing and discovery across multiple instances.

**⚠️ Warning: This project is not production-ready yet.**

## Development

### Using Docker (Recommended)

```bash
# Start development server (Terminal 1)
npm run docker:dev

# Start test watcher in separate terminal (Terminal 2)
npm run docker:test
```

The dev environment starts two instances (app1 and app2) that watch all frontend and backend code changes. Both are served by Caddy at `http://app1.local` and `http://app2.local`. Each instance runs both backend and frontend; the frontend proxies API requests to the backend. Add these domains to your hosts file: `app1.local`, `app2.local`, and `test.local`. Edit `/etc/hosts` and add `127.0.0.1 app1.local app2.local test.local`. The test watcher monitors source code changes and runs tests automatically.

### Local Development

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Set up database
npx prisma generate
npx prisma db push
npx prisma db seed

# Start development servers (Terminal 1)
npm run dev

# Start test watcher in separate terminal (Terminal 2)
npm run test:watch
```

## Production

```bash
# Build
npm run build

# Start
npm start
```

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
