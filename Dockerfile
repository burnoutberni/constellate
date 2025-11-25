# Development stage
FROM node:20-alpine AS development

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install all dependencies (including dev)
RUN npm ci
RUN cd client && npm ci

# Generate Prisma Client
COPY prisma ./prisma
RUN npx prisma generate

# Expose port
EXPOSE 3000

# Start in dev mode (will be overridden by docker-compose command)
CMD ["npm", "run", "dev"]
