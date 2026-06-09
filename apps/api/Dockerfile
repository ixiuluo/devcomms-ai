# syntax=docker/dockerfile:1

# ── Build stage ──────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Copy workspace config
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./

# Copy workspace packages
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/
COPY packages/shared/src packages/shared/src

COPY apps/api/package.json apps/api/tsconfig.json apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma
COPY apps/api/src apps/api/src

# Install all dependencies and build
RUN npm ci && \
    npm run build -w packages/shared && \
    npm run build -w apps/api

# ── Production stage ─────────────────────────────────────────
FROM node:22-alpine AS production

RUN addgroup -S dra && adduser -S dra -G dra

WORKDIR /app

# Copy workspace config and production package files
COPY --from=build /app/package.json /app/package-lock.json /app/tsconfig.base.json /app/tsconfig.json ./
COPY --from=build /app/packages/shared/package.json /app/packages/shared/
COPY --from=build /app/packages/shared/dist /app/packages/shared/dist
COPY --from=build /app/apps/api/package.json /app/apps/api/prisma.config.ts /app/apps/api/
COPY --from=build /app/apps/api/prisma /app/apps/api/prisma
COPY --from=build /app/apps/api/dist /app/apps/api/dist

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts && \
    chown -R dra:dra /app

USER dra

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/health').then(r => {if(!r.ok) process.exit(1)})"

# Migrate then start
CMD ["sh", "-c", "cd apps/api && npx prisma migrate deploy && node dist/index.js"]
