#!/bin/sh
set -e

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

echo "🚀 Starting Development Server..."
"$@" &
server_pid=$!

echo "Waiting for API to be ready..."
until curl -f http://localhost:3000/health > /dev/null 2>&1; do
  sleep 1
done

echo "API ready, running seed..."
npm run db:seed

echo "Seed complete, server running..."
wait $server_pid
