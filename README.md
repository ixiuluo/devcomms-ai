# DRA

DRA monorepo — AI-amplified product development.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start required services
docker compose up -d

# 3. Build shared packages
npm run build --workspace packages/shared

# 4. Start the API in dev mode
npm run dev -w apps/api
```

The API will be running at `http://localhost:3000`. Health check: `http://localhost:3000/health`

## Prerequisites

- **Node.js** >= 20.0.0
- **Docker** (for PostgreSQL and Redis in development)
- **npm** >= 10.0.0

## Project Structure

```
/
├── apps/
│   └── api/              # Express API server
├── packages/
│   └── shared/           # Shared types and utilities
├── docs/                 # Documentation
├── docker-compose.yml    # Local dev services
├── .github/workflows/    # CI pipeline
└── tsconfig.base.json    # Shared TypeScript config
```

## Scripts

| Command              | Description                       |
| -------------------- | --------------------------------- |
| `npm run dev`        | Start all apps in dev mode        |
| `npm run build`      | Build all packages and apps       |
| `npm test`           | Run all tests                     |
| `npm run lint`       | Lint all code                     |
| `npm run lint:fix`   | Auto-fix lint issues              |
| `npm run format`     | Format all code with Prettier     |
| `npm run format:check` | Check formatting                |
| `npm run typecheck`  | Type-check all packages           |
| `npm run clean`      | Remove build artifacts            |

## Development

See [docs/development.md](docs/development.md) for detailed setup instructions, tooling guide, and AI agent collaboration patterns.

## Tech Stack

- **Runtime**: Node.js 22, TypeScript 5.7
- **API**: Express 4
- **Database**: PostgreSQL 16 (via Docker)
- **Cache**: Redis 7 (via Docker)
- **Testing**: Vitest
- **Linting**: ESLint 9 (flat config) + Prettier
- **CI**: GitHub Actions
