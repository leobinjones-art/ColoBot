# ColoBot Production Dockerfile
# Multi-stage build for optimized image size

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/types/package*.json ./packages/types/
COPY packages/charter/package*.json ./packages/charter/
COPY packages/sentinel/package*.json ./packages/sentinel/
COPY packages/core/package*.json ./packages/core/
COPY packages/tui/package*.json ./packages/tui/

# Install dependencies
RUN npm ci

# Copy source code
COPY packages/types ./packages/types
COPY packages/charter ./packages/charter
COPY packages/sentinel ./packages/sentinel
COPY packages/core ./packages/core
COPY packages/tui ./packages/tui
COPY tsconfig.json ./

# Build packages
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/charter/dist ./packages/charter/dist
COPY --from=builder /app/packages/sentinel/dist ./packages/sentinel/dist
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/tui/dist ./packages/tui/dist

# Copy package.json for each package
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/charter/package.json ./packages/charter/
COPY --from=builder /app/packages/sentinel/package.json ./packages/sentinel/
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/tui/package.json ./packages/tui/

# Create non-root user
RUN addgroup -g 1001 -S colobot && \
    adduser -S -D -H -u 1001 -s /sbin/nologin -G colobot colobot && \
    chown -R colobot:colobot /app

USER colobot

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

EXPOSE 3000

# Default command (can be overridden)
CMD ["node", "packages/tui/dist/cli.js"]
