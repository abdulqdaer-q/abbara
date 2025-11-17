# Multi-stage build for MoveNow Pricing Service

# Stage 1: Dependencies
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm prisma:generate

# Stage 2: Builder
FROM node:18-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build application
RUN pnpm build

# Stage 3: Runner
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 pricing

# Copy built application
COPY --from=builder --chown=pricing:nodejs /app/dist ./dist
COPY --from=builder --chown=pricing:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=pricing:nodejs /app/package.json ./package.json
COPY --from=builder --chown=pricing:nodejs /app/prisma ./prisma

USER pricing

EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/index.js"]
