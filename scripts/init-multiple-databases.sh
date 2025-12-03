#!/bin/bash
set -e

# Initialize multiple databases in PostgreSQL
# This script runs on first container start

function create_database() {
    local db_name=$1
    echo "Creating database: $db_name"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
        CREATE DATABASE $db_name;
EOSQL
}

# Create databases from POSTGRES_MULTIPLE_DATABASES env var
if [ -n "$POSTGRES_MULTIPLE_DATABASES" ]; then
    for db in $(echo $POSTGRES_MULTIPLE_DATABASES | tr ',' ' '); do
        create_database $db
    done
    echo "Multiple databases created"
fi

