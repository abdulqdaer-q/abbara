# Multi-stage Dockerfile for Porters Service

# Stage 1: Dependencies
FROM node:18-alpine AS deps
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY ../../packages/common ./packages/common

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# Stage 2: Builder
FROM node:18-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* tsconfig.json ./
COPY ../../packages/common ./packages/common

# Install all dependencies (including dev)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY src ./src
COPY prisma ./prisma

# Generate Prisma client
RUN pnpm prisma generate

# Build TypeScript
RUN pnpm build

# Stage 3: Production Runtime
FROM node:18-alpine AS runner
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 porters

# Copy dependencies from deps stage
COPY --from=deps --chown=porters:nodejs /app/node_modules ./node_modules

# Copy built application from builder
COPY --from=builder --chown=porters:nodejs /app/dist ./dist
COPY --from=builder --chown=porters:nodejs /app/prisma ./prisma
COPY --from=builder --chown=porters:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=porters:nodejs /app/package.json ./package.json

# Create logs directory
RUN mkdir -p logs && chown -R porters:nodejs logs

# Switch to non-root user
USER porters

# Expose ports
EXPOSE 4002 9090

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4002/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start the service
CMD ["node", "dist/index.js"]

# Development stage
FROM builder AS development
WORKDIR /app

# Install tsx for development
RUN pnpm add -D tsx

# Expose ports
EXPOSE 4002 9090

# Start with hot reload
CMD ["pnpm", "dev"]
