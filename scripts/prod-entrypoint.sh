#!/bin/sh
set -e

# Construct DATABASE_URL from secrets if present
if [ -n "$POSTGRES_PASSWORD_FILE" ] && [ -f "$POSTGRES_PASSWORD_FILE" ]; then
  POSTGRES_PASSWORD=$(cat "$POSTGRES_PASSWORD_FILE")
  export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public"
  echo "✅ Constructed DATABASE_URL from secrets"
else
  echo "⚠️ POSTGRES_PASSWORD_FILE not set or file does not exist, aborting."
  exit 1
fi

echo "⏳ Waiting for database to be ready and running migrations..."
# Retry migration until database is ready (max 30 attempts, 1 second apart)
max_attempts=30
attempt=0
success=false

while [ $attempt -lt $max_attempts ]; do
  attempt=$((attempt + 1))
  echo "  Attempt $attempt/$max_attempts: Running migrations..."
  
  # Try to run migrations
  if npx prisma migrate deploy; then
    echo "✅ Migrations completed successfully!"
    success=true
    break
  else
    exit_code=$?
    # If it's the last attempt, fail
    if [ $attempt -eq $max_attempts ]; then
      echo "❌ ERROR: Failed to run migrations after $max_attempts attempts"
      exit $exit_code
    fi
    echo "  Database not ready yet, waiting 1 second..."
    sleep 1
  fi
done

if [ "$success" = false ]; then
  echo "❌ ERROR: Failed to run migrations"
  exit 1
fi

echo "🚀 Starting Production Server..."
exec "$@"
