#!/bin/sh
set -e

echo "🔄 Checking dependencies..."
# Ensure dependencies are installed if volume mount hid them
if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules)" ]; then
    echo "📦 Installing server dependencies..."
    npm ci
fi

if [ ! -d "client/node_modules" ] || [ -z "$(ls -A client/node_modules)" ]; then
    echo "📦 Installing client dependencies..."
    cd client && npm ci && cd ..
fi

echo "🗄️  Syncing Database Schema..."
# Generate Prisma client first
npx prisma generate

# Push schema changes to DB
npx prisma db push --skip-generate

echo "🌱 Seeding Database..."
npm run db:seed

echo "🚀 Starting Development Server..."
exec "$@"
