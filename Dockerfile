# Production Dockerfile for @dra/api
# Multi-stage build for minimal image size

# ---- Build stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace config
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/

# Install all dependencies
RUN npm ci

# Copy source code
COPY packages/shared/src ./packages/shared/src
COPY apps/api/src ./apps/api/src

# Build TypeScript
RUN npm run build -w packages/shared
RUN npm run build -w apps/api

# Prune dev dependencies
RUN npm prune --production

# ---- Production stage ----
FROM node:22-alpine AS runner

RUN addgroup --system --gid 1001 dra && adduser --system --uid 1001 dra

WORKDIR /app

# Copy built artifacts and production node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist

USER dra

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "apps/api/dist/index.js"]
