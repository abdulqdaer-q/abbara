# Multi-stage build for Admin Management Service

# Stage 1: Build
FROM node:18-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml ./
COPY services/admin-management/package.json ./services/admin-management/
COPY packages/common/package.json ./packages/common/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY services/admin-management ./services/admin-management
COPY packages/common ./packages/common

# Generate Prisma Client
WORKDIR /app/services/admin-management
RUN pnpm prisma:generate

# Build the application
RUN pnpm build

# Stage 2: Production
FROM node:18-alpine AS production

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/services/admin-management/package.json ./services/admin-management/
COPY --from=builder /app/packages/common/package.json ./packages/common/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built application
COPY --from=builder /app/services/admin-management/dist ./services/admin-management/dist
COPY --from=builder /app/services/admin-management/prisma ./services/admin-management/prisma
COPY --from=builder /app/services/admin-management/node_modules/.prisma ./services/admin-management/node_modules/.prisma
COPY --from=builder /app/packages/common/dist ./packages/common/dist

# Set working directory to service
WORKDIR /app/services/admin-management

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/index.js"]
