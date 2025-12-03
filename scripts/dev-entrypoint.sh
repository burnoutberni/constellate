#!/bin/sh
set -e

echo "🔄 Checking dependencies..."

# Function to check if dependencies need updating
check_and_install_deps() {
    local dir=$1
    local name=$2
    
    if [ "$dir" = "." ]; then
        cd /app
    else
        cd /app/$dir
    fi
    
    # Check if node_modules exists and is not empty
    if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
        echo "📦 Installing $name dependencies (missing node_modules)..."
        npm ci
    else
        # Check if package-lock.json is newer than node_modules or if package.json changed
        if [ -f "package-lock.json" ]; then
            if [ "package-lock.json" -nt "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
                echo "📦 Updating $name dependencies (package files changed)..."
                npm ci
            else
                echo "✅ $name dependencies are up to date"
            fi
        else
            # No lock file, install dependencies
            echo "📦 Installing $name dependencies (no lock file)..."
            npm install
        fi
    fi
    
    if [ "$dir" != "." ]; then
        cd /app
    fi
}

# Install/update server dependencies
check_and_install_deps "." "server"

# Install/update client dependencies
check_and_install_deps "client" "client"

echo "🗄️  Syncing Database Schema..."
# Generate Prisma client first
npx prisma generate

# Push schema changes to DB
npx prisma db push --skip-generate

echo "🌱 Seeding Database..."
npm run db:seed

echo "🚀 Starting Development Server..."
exec "$@"
