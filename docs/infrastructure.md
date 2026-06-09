# Infrastructure & Deployment

DRA infrastructure decisions for DevComms AI. This document is the source of truth for how we deploy, monitor, and operate the product. Written for AI agents to recover the system from.

## Deployment Target Decision

**Decision: Fly.io (primary) with Docker-based portability**

Evaluated against DevComms AI requirements (Node.js/Express API, Next.js frontend, PostgreSQL 16, Redis 7, GitHub webhooks, MVP scale):

| Option | Cost/mo | Postgres | Redis | GitHub Deploy | Complexity | Verdict |
|--------|---------|----------|-------|---------------|------------|---------|
| **Fly.io** | ~$0-6 | Fly Postgres ($) | Self-managed / Upstash | CI via flyctl | Medium | **Selected** |
| Railway | $5+ | Built-in | Built-in | Auto | Low | Fallback |
| Render | $0+ | Add-on ($) | Add-on ($) | Auto | Low | Fallback |
| Hetzner VPS | ~€5 | Self-managed | Self-managed | CI needed | High | Scale-up option |
| AWS ECS | $30+ | RDS ($) | ElastiCache ($) | CI needed | High | No |

### Domain lenses applied

- **Capital efficiency**: Fly.io has a generous free tier (3 shared VMs). At MVP scale, costs are near zero. Fly Postgres starts at ~$1.50/mo.
- **Simplicity**: Standard Docker deployment. `fly.toml` is the single source of deployment config. `flyctl deploy` from CI.
- **Boring technology**: Fly.io runs standard Docker containers on Firecracker VMs. Zero vendor lock-in — the same Dockerfile works anywhere.
- **Shipping velocity**: `flyctl deploy` from CI merges main → staging. Manual workflow_dispatch for production.
- **Reversibility**: Docker-based. Migrate to Railway, Render, or VPS in under an hour.

### Why Fly.io over Railway?

Fly.io was chosen because:
- More mature platform with better CLI and API
- Fly Postgres is a managed database with automatic backups
- Edge deployment (AMS region) keeps latency low for European users
- Free tier supports the full MVP without any cost
- `fly.toml` is checked into the repo — infrastructure as code

### Why not VPS directly?

A Hetzner VPS at €5/mo is cheaper raw compute, but:
- PostgreSQL and Redis need manual setup, backups, and monitoring
- GitHub webhook delivery needs TLS termination (certbot, nginx config)
- Zero-downtime deploys need custom scripting
- This is operational overhead an OPC doesn't need in month 1

We can migrate to VPS when MRR justifies the ops time (~$2K MRR threshold).

## Environments

### Staging

- Fly.io app from `main` branch auto-deploy
- Separate PostgreSQL/Redis instances
- Domain: `staging.devcomms.ai`
- Auto-deployed on push to `main` via CI

### Production

- Fly.io app, manual deploy trigger
- Domain: `devcomms.ai`
- Triggered via `workflow_dispatch` with `deploy_production: true`
- Separate PostgreSQL/Redis with Fly Postgres backups enabled
- PagerDuty-free: AI agents monitor and respond

## Monitoring & Observability

### Health Checks

- `GET /health` — basic liveness (HTTP 200 = alive)
- `GET /health/ready` — readiness (includes DB + Redis connectivity)
- Fly.io auto-restarts on health check failure (configured in fly.toml)

### Error Tracking

- **Sentry** for error tracking and performance monitoring
- Free tier: 5K errors/month (sufficient for MVP)
- SDK: `@sentry/node` with Express integration
- Environment: `SENTRY_DSN` env var

### Uptime Monitoring

- **UptimeRobot** (free, 50 monitors, 5-min intervals)
- Monitors: `GET /health` on both staging and production
- Alerts: email to CTO

### Logging

- Fly.io captures stdout/stderr via `fly logs`
- Morgan request logging in `combined` format for production (stdout)
- Structured JSON logging planned for post-MVP

## Cost Alerting

### Infrastructure Cost Baseline

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| Fly.io (compute) | Free tier / Hobby | $0-6.00 |
| Fly Postgres | Hobby | ~$1.50 |
| Upstash Redis | Free | $0.00 |
| Sentry | Free | $0.00 |
| UptimeRobot | Free | $0.00 |
| GitHub | Free | $0.00 |
| Domain (devcomms.ai) | Annual | ~$1.00/mo |
| **Total** | | **~$2.50-8.50/mo** |

### Alert Thresholds

| Alert | Threshold | Action |
|-------|-----------|--------|
| Fly.io spend | > $20/mo | CTO reviews usage |
| Fly.io spend | > $50/mo | CEO approval required |
| API errors (Sentry) | > 50/hour | CTO investigates |
| Uptime | < 99.5% (7d) | Post-mortem |

### Tracking

- Fly.io dashboard shows real-time spend
- Monthly cost review in `docs/cost-tracking.md`
- Budget: $30/mo hard cap for MVP phase

## Deployment Flow

```
Developer pushes to GitHub
  ├── PR → CI (lint, typecheck, test, build)
  └── Merge to main
      ├── CI (lint, typecheck, test, build)
      └── Deploy to Fly.io (auto)

Production deploy
  └── workflow_dispatch with deploy_production: true
```

## Recovery Procedures

### App is down

1. Check Fly.io dashboard (`fly status`) for service status
2. Check Sentry for error spike
3. Check `GET /health/ready` for DB/Redis connectivity
4. Roll back via `flyctl deploy --image <previous-image>`
5. If Fly.io is down: check https://status.fly.io. If >30min, manually deploy Docker to Hetzner fallback.

### Database restore

1. Fly Postgres → `flyctl postgres restore` or point-in-time recovery
2. Verify with `GET /health/ready`
3. Notify CEO if data loss > 1 hour

### Secrets compromised

1. Rotate all secrets via `flyctl secrets set`
2. Regenerate GitHub App private key
3. Update `SENTRY_DSN` if needed
4. Redeploy all environments

## References

- [Fly.io Docs](https://fly.io/docs)
- [Sentry Node.js SDK](https://docs.sentry.io/platforms/node/)
- [UptimeRobot](https://uptimerobot.com)
