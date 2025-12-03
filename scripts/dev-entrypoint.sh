#!/bin/sh
set -e

echo "🔄 Checking dependencies..."

echo "📦 Installing server dependencies..."
npm install

echo "📦 Installing client dependencies..."
cd client && npm install && cd ..

echo "🗄️  Setting up Database..."
# Generate Prisma client first
npx prisma generate

# Run migrations
# If no migrations exist, this will create and apply the initial one
# If migrations exist, this will apply any pending ones
echo "Running database migrations..."
if [ -z "$(ls -A /app/prisma/migrations 2>/dev/null | grep -v README)" ]; then
  echo "No migrations found, creating initial migration..."
  npx prisma migrate dev --name init
else
  echo "Applying existing migrations..."
  npx prisma migrate deploy
fi

echo "🌱 Seeding Database..."
npm run db:seed

echo "🚀 Starting Development Server..."
exec "$@"
