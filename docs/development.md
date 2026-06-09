# Development Guide

This document describes how to set up and work with the DRA development environment.
It is written for both human engineers and AI agents.

## Prerequisites

- **Node.js** >= 20.0.0 (recommended: 22 LTS)
- **Docker Desktop** (for local PostgreSQL and Redis)
- **npm** >= 10.0.0
- **Git**

## One-Time Setup

```bash
# Clone the repository
git clone <repo-url>
cd dra

# Install all dependencies
npm install

# Start local services (PostgreSQL, Redis)
docker compose up -d

# Verify services are healthy
docker compose ps

# Build shared packages (required for apps to import from @dra/shared)
npm run build -w packages/shared
```

To verify everything works:

```bash
# Type check
npx tsc --build

# Run tests
npm test

# Lint
npm run lint
```

## Daily Development

### Running the API

```bash
# Start in dev mode (hot reload via tsx)
npm run dev -w apps/api
```

The API runs on `http://localhost:3000` by default. Set `PORT` env var to change.

### Running Tests

```bash
# All tests
npm test

# Single workspace
npm test -w packages/shared

# Watch mode
npm run test:watch -w apps/api
```

### Database

Local PostgreSQL is accessible at:

- Host: `localhost:5432`
- User: `dra`
- Password: `dra`
- Database: `dra_dev`

Connect with: `docker compose exec postgres psql -U dra -d dra_dev`

### Linting & Formatting

```bash
# Check lint
npm run lint

# Auto-fix lint
npm run lint:fix

# Format code
npm run format

# Check formatting (CI mode)
npm run format:check
```

## Project Structure

```
/
├── apps/                  # Application entry points
│   └── api/              # Express API server
│       ├── src/
│       │   ├── index.ts  # App entry point
│       │   └── *.test.ts # Tests
│       └── tsconfig.json
├── packages/              # Shared libraries
│   └── shared/           # @dra/shared — types, constants, utilities
│       ├── src/
│       │   ├── index.ts
│       │   └── *.test.ts
│       └── tsconfig.json
├── docs/                  # Documentation
├── .github/workflows/    # CI pipeline definitions
├── .vscode/              # VSCode settings and recommended extensions
├── docker-compose.yml    # Local infrastructure
├── tsconfig.base.json    # Base TypeScript config (extended by all packages)
├── tsconfig.json         # Root project references
├── eslint.config.mjs     # ESLint flat config
└── .prettierrc           # Prettier config
```

## Architecture Decisions

### Monorepo with npm Workspaces

We use native npm workspaces rather than Turborepo or Nx. At our scale (small team, few packages), native workspaces are simpler to understand and debug. We can migrate to Turborepo later if needed.

### Express over Next.js/Fastify

Express is chosen as the initial API framework because:
- Most engineers and AI agents are familiar with it
- Massive ecosystem and middleware
- Simple mental model — fewer abstractions to debug at 3 AM

A frontend framework (Next.js, Vite + React, etc.) will be added once the product scope is defined in DRA-4.

### TypeScript Strict Mode

All strict checks are enabled from day one. This catches bugs early and provides better IDE support for AI agents operating on the codebase.

### ESLint Flat Config

ESLint 9's flat config is the new standard. We use TypeScript ESLint with strict-type-checked and stylistic-type-checked rules.

### Docker Compose for Local Services

PostgreSQL and Redis run locally via Docker Compose. This avoids cloud dependencies during development and keeps costs at zero. No SaaS database tier needed for development.

## Adding a New Package

```bash
# Create the package directory
mkdir -p packages/my-package/src

# Add package.json
# (copy from packages/shared, update name to @dra/my-package)

# Add tsconfig.json extending tsconfig.base.json

# Add to root tsconfig.json references

# Install and build
npm install
npm run build -w packages/my-package
```

## AI Agent Collaboration

This codebase is designed for AI agents to operate on it:

1. **Structured configs**: All tooling is configured via explicit JSON/JS files, not magic defaults
2. **Clear workspace boundaries**: Each package has a clear purpose and entry point
3. **Typed interfaces**: TypeScript strict mode ensures agents get immediate feedback on type errors
4. **Documented patterns**: This file serves as the source of truth for how the project works
5. **CI-enforced quality**: Agents can rely on CI to catch issues; the feedback loop is fast

## Troubleshooting

### Build fails with "Cannot find module @dra/shared"

Run `npm run build -w packages/shared` first. Workspace packages need to be built before apps can import them.

### Port 5432 already in use

Another PostgreSQL instance is running. Stop it or update `docker-compose.yml` to use a different port.

### ESLint errors about missing files

Run `npx tsc --build` to generate TypeScript declaration files. ESLint's project service needs up-to-date tsconfig references.

### Docker services won't start

Ensure Docker Desktop is running: `docker info`
