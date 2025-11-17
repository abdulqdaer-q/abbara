# Multi-stage Dockerfile for Auth & Users Service

# Stage 1: Base image with dependencies
FROM node:20-alpine AS base
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY ../../pnpm-workspace.yaml* ../../
COPY ../../packages/common/package.json ../../packages/common/

# Stage 2: Development dependencies
FROM base AS dev-deps
RUN pnpm install --frozen-lockfile

# Stage 3: Production dependencies
FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod

# Stage 4: Build
FROM base AS build
COPY --from=dev-deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN pnpm prisma:generate

# Build TypeScript
RUN pnpm build

# Stage 5: Development image
FROM node:20-alpine AS development
WORKDIR /app

RUN npm install -g pnpm

COPY --from=dev-deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3001
CMD ["pnpm", "dev"]

# Stage 6: Production image
FROM node:20-alpine AS production
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./

# Change ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["pnpm", "start"]
