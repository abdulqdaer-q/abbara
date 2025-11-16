# Multi-stage Dockerfile for Orders Service

# Stage 1: Dependencies
FROM node:18-alpine AS dependencies
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY packages/common/package.json ./packages/common/
COPY services/orders-service/package.json ./services/orders-service/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:18-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package.json ./package.json

# Copy source code
COPY packages/common ./packages/common
COPY services/orders-service ./services/orders-service

# Build common package
WORKDIR /app/packages/common
RUN pnpm run build

# Build orders service
WORKDIR /app/services/orders-service
RUN pnpm run build

# Generate Prisma client
RUN pnpm run prisma:generate

# Stage 3: Production
FROM node:18-alpine AS production
WORKDIR /app

# Install pnpm and dumb-init for proper signal handling
RUN npm install -g pnpm && apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy built artifacts
COPY --from=builder --chown=nodejs:nodejs /app/services/orders-service/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/services/orders-service/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/services/orders-service/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/services/orders-service/prisma ./prisma

# Set environment
ENV NODE_ENV=production
ENV PORT=4001

# Expose port
EXPOSE 4001
EXPOSE 9090

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); });"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]
