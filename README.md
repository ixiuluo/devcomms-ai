# DevComms AI

AI-powered developer communication platform. Automated changelogs from git history → hosted page → email/Slack distribution. AI agents write, categorize, and publish. Humans approve with one click.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start required services
docker compose up -d

# 3. Build all packages
npm run build

# 4. Start the API (terminal 1)
npm run dev -w apps/api

# 5. Start the frontend (terminal 2)
npm run dev -w apps/web
```

- **API**: `http://localhost:3000` — health check at `/health`
- **Web**: `http://localhost:3001` — landing page and dashboard

## Prerequisites

- **Node.js** >= 20.0.0 (LTS 22 recommended)
- **Docker** (for PostgreSQL and Redis in development)
- **npm** >= 10.0.0

## Project Structure

```
/
├── apps/
│   ├── api/              # Express API — changelog generation, GitHub webhooks, publishing
│   └── web/              # Next.js — landing page, dashboard, hosted changelogs
├── packages/
│   └── shared/           # @dra/shared — types, constants, ApiResponse<T>
├── docs/                 # Documentation
├── docker-compose.yml    # Local dev services (PostgreSQL 16 + Redis 7)
├── Dockerfile            # Multi-stage production build for the API
├── fly.toml              # Fly.io deployment config
├── .github/workflows/    # CI pipeline (lint → typecheck → test → build → deploy)
└── tsconfig.base.json    # Shared TypeScript config
```

## Scripts

| Command                | Description                          |
| ---------------------- | ------------------------------------ |
| `npm run dev`          | Start all apps in dev mode           |
| `npm run build`        | Build all packages and apps          |
| `npm test`             | Run all tests (7 tests)              |
| `npm run lint`         | Lint all code                        |
| `npm run lint:fix`     | Auto-fix lint issues                 |
| `npm run format`       | Format all code with Prettier        |
| `npm run format:check` | Check formatting                     |
| `npm run typecheck`    | Type-check all packages              |
| `npm run clean`        | Remove build artifacts               |

## Development

See [docs/development.md](docs/development.md) for detailed setup instructions, architecture decisions, and AI agent collaboration patterns.

## Tech Stack

| Layer          | Technology                                  |
| -------------- | ------------------------------------------- |
| **Runtime**    | Node.js 22, TypeScript 5.7                  |
| **API**        | Express 4, Helmet, Morgan                   |
| **Frontend**   | Next.js 15, React 19, Tailwind CSS 4        |
| **Database**   | PostgreSQL 16 (Docker in dev)               |
| **Cache**      | Redis 7 (Docker in dev)                     |
| **Testing**    | Vitest                                      |
| **Linting**    | ESLint 9 (flat config) + Prettier           |
| **CI/CD**      | GitHub Actions → Fly.io (API) + Vercel (Web)|
| **Monitoring** | Sentry (error tracking), `/health` probes   |

## Deployment

- **API**: `flyctl deploy --config fly.toml` (Fly.io)
- **Web**: Vercel (auto-deploy from GitHub)
- **CI**: Lint → TypeCheck → Test → Build → Deploy

