#!/bin/sh
set -e

echo "🗄️  Running Migrations..."
npx prisma migrate deploy

echo "🚀 Starting Production Server..."
exec "$@"
