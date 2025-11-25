#!/bin/bash

# Script to reset Docker development databases
# This will remove all volumes and restart containers

echo "🔄 Resetting Docker development environment..."

# Stop and remove containers, networks, and volumes
echo "Stopping containers..."
docker-compose down -v

# Remove database files if they exist in volumes
echo "Cleaning up volumes..."
docker volume rm stellar-calendar_app1-data stellar-calendar_app2-data 2>/dev/null || true

echo ""
echo "✅ Docker environment reset complete!"

