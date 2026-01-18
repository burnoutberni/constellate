# =========================
# Base stage
# =========================
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# =========================
# Dependencies stage
# =========================
FROM base AS deps
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm ci
RUN cd client && npm ci

# =========================
# Development stage (NO SOURCE CODE)
# =========================
FROM base AS development
WORKDIR /app
RUN apk add --no-cache curl

# Copy dependencies only
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/client/node_modules ./client/node_modules

# Source code is provided via bind mount
EXPOSE 3000

# Start dev server
CMD ["npm", "run", "dev"]

# =========================
# Builder stage (PROD)
# =========================
FROM base AS builder
WORKDIR /app

# Copy deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/client/node_modules ./client/node_modules

# Copy full source (OK for prod)
COPY . .

# Build-time steps
RUN npx prisma generate
RUN npm run build

# =========================
# Production stage
# =========================
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy built artifacts only
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/client/dist ./client/dist
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

USER nextjs

EXPOSE 3000
CMD ["node", "dist/server.js"]
