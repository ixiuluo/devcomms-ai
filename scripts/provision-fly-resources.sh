#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# DevComms AI — Fly.io Resource Provisioning Script
# ──────────────────────────────────────────────────────────────
# Run once to provision all Fly.io infrastructure for DevComms AI.
# Prerequisites: flyctl installed and authenticated (`flyctl auth login`).
#
# Usage: bash scripts/provision-fly-resources.sh
#
# This script is idempotent — safe to re-run.
# ──────────────────────────────────────────────────────────────

set -euo pipefail

REGION="ams"
PROD_APP="devcomms-api"
STAGING_APP="devcomms-api-staging"
PROD_DOMAIN="devcomms.ai"
STAGING_DOMAIN="staging.devcomms.ai"
POSTGRES_APP="devcomms-db"

# ── ANSI helpers ──────────────────────────────────────────────
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
green() { printf '\033[32m✓ %s\033[0m\n' "$*"; }
info()  { printf '→ %s\n' "$*"; }
warn()  { printf '\033[33m⚠ %s\033[0m\n' "$*"; }
fail()  { printf '\033[31m✗ %s\033[0m\n' "$*"; exit 1; }

# ── Step 1: Verify flyctl ─────────────────────────────────────
bold "Step 1: Verify flyctl"
if ! command -v flyctl &>/dev/null; then
  fail "flyctl not found. Install: curl -L https://fly.io/install.sh | sh"
fi
flyctl version
green "flyctl ready"

# ── Step 2: Create Fly.io apps ────────────────────────────────
bold "Step 2: Create Fly.io apps"

info "Creating production app: $PROD_APP"
flyctl apps create "$PROD_APP" --org dra 2>/dev/null || warn "$PROD_APP already exists"

info "Creating staging app: $STAGING_APP"
flyctl apps create "$STAGING_APP" --org dra 2>/dev/null || warn "$STAGING_APP already exists"

green "Apps created"

# ── Step 3: Provision Fly Postgres (production) ───────────────
bold "Step 3: Provision Fly Postgres"

info "Creating Postgres cluster: $POSTGRES_APP (VM size: shared-cpu-1x, 1GB disk)"
flyctl postgres create \
  --name "$POSTGRES_APP" \
  --region "$REGION" \
  --vm-size shared-cpu-1x \
  --volume-size 1 \
  --initial-cluster-size 1 \
  2>/dev/null || warn "$POSTGRES_APP already exists"

info "Attaching Postgres to production app..."
flyctl postgres attach "$POSTGRES_APP" --app "$PROD_APP" 2>/dev/null || warn "Already attached to $PROD_APP"

info "Attaching Postgres to staging app..."
flyctl postgres attach "$POSTGRES_APP" --app "$STAGING_APP" \
  --database-name dra_staging \
  --database-user dra_staging \
  2>/dev/null || warn "Already attached to $STAGING_APP"

green "Postgres provisioned"

# ── Step 4: Provision Redis (Upstash) ─────────────────────────
bold "Step 4: Provision Redis"

cat << 'REDIS_HELP'

Upstash Redis is provisioned outside Fly.io. Steps:
  1. Go to https://console.upstash.com/redis
  2. Create a new Redis database (free tier: 256MB)
  3. Choose region: eu-west-1 (closest to Fly.io AMS)
  4. Copy the REST URL (format: https://<token>@<endpoint>.upstash.io)
  5. Set as secret: flyctl secrets set REDIS_URL="<upstash-url>" --app $PROD_APP

For staging, create a second database and set on staging app.

REDIS_HELP

info "Set Upstash Redis URL as secret on production..."
read -rp "Enter REDIS_URL for production (or press Enter to skip): " redis_url_prod
if [ -n "$redis_url_prod" ]; then
  flyctl secrets set "REDIS_URL=$redis_url_prod" --app "$PROD_APP"
  green "REDIS_URL set on $PROD_APP"
fi

info "Set Upstash Redis URL as secret on staging..."
read -rp "Enter REDIS_URL for staging (or press Enter to skip): " redis_url_staging
if [ -n "$redis_url_staging" ]; then
  flyctl secrets set "REDIS_URL=$redis_url_staging" --app "$STAGING_APP"
  green "REDIS_URL set on $STAGING_APP"
fi

# ── Step 5: Configure secrets ─────────────────────────────────
bold "Step 5: Configure secrets"

info "Setting secrets on $PROD_APP..."
# Generate a secure session secret
SESSION_SECRET=$(openssl rand -hex 32)
info "Generated SESSION_SECRET=${SESSION_SECRET:0:8}..."

flyctl secrets set "SESSION_SECRET=$SESSION_SECRET" --app "$PROD_APP"

info "Setting secrets on $STAGING_APP..."
STAGING_SESSION_SECRET=$(openssl rand -hex 32)
flyctl secrets set "SESSION_SECRET=$STAGING_SESSION_SECRET" --app "$STAGING_APP"

# Prompt for optional secrets
read -rp "Enter SENTRY_DSN for production (or press Enter to skip): " sentry_dsn
if [ -n "$sentry_dsn" ]; then
  flyctl secrets set "SENTRY_DSN=$sentry_dsn" --app "$PROD_APP"
  flyctl secrets set "SENTRY_DSN=$sentry_dsn" --app "$STAGING_APP"
fi

read -rp "Enter Stripe secret key for production (or press Enter to skip): " stripe_key
if [ -n "$stripe_key" ]; then
  flyctl secrets set "STRIPE_SECRET_KEY=$stripe_key" --app "$PROD_APP"
fi

read -rp "Enter Stripe secret key for staging (or press Enter to skip): " stripe_staging_key
if [ -n "$stripe_staging_key" ]; then
  flyctl secrets set "STRIPE_SECRET_KEY=$stripe_staging_key" --app "$STAGING_APP"
fi

green "Secrets configured"

# ── Step 6: Set up custom domains ─────────────────────────────
bold "Step 6: Set up custom domains"

info "Configuring SSL certificates for production domain: $PROD_DOMAIN"
flyctl certs create "$PROD_DOMAIN" --app "$PROD_APP" 2>/dev/null || warn "Certificate for $PROD_DOMAIN may already exist"

info "Configuring SSL certificates for staging domain: $STAGING_DOMAIN"
flyctl certs create "$STAGING_DOMAIN" --app "$STAGING_APP" 2>/dev/null || warn "Certificate for $STAGING_DOMAIN may already exist"

cat << 'DNS_HELP'

DNS Setup Required:
  Add the following DNS records at your domain registrar:

  Production (devcomms.ai):
    A     @     → 66.241.124.59    (Fly.io anycast IP)
    AAAA  @     → 2a09:8280:1::a:5c6d
    CNAME www   → devcomms-api.fly.dev

  Staging (staging.devcomms.ai):
    CNAME staging → devcomms-api-staging.fly.dev

  After adding records, verify: flyctl certs check --app <app-name>

DNS_HELP

# ── Step 7: Set up GitHub Actions secrets ─────────────────────
bold "Step 7: Set up GitHub Actions secrets"

cat << 'GITHUB_HELP'
Add these secrets in GitHub → Settings → Secrets and variables → Actions:

  Environment: staging
    FLY_API_TOKEN_STAGING   → flyctl auth token (create: flyctl auth token)

  Environment: production
    FLY_API_TOKEN_PRODUCTION → flyctl auth token (create: flyctl auth token)

To create tokens:
  flyctl auth token

Note: Use separate tokens for staging and production (different Fly.io orgs or
restricted tokens preferred). At minimum, use the same org-level token for both.

GITHUB_HELP

# ── Step 8: Deploy staging first ──────────────────────────────
bold "Step 8: Deploy staging"

info "Deploying to staging..."
flyctl deploy --config fly.staging.toml --app "$STAGING_APP" --remote-only

info "Verifying staging health..."
sleep 5
STAGING_URL="https://${STAGING_DOMAIN}"
curl -sf "${STAGING_URL}/health" && green "Staging health check passed" || warn "Staging health check failed — check fly logs"

# ── Step 9: Deploy production ─────────────────────────────────
bold "Step 9: Deploy production"

cat << 'CONFIRM'
Ready to deploy to production (devcomms.ai).
This will make the app publicly available.
CONFIRM

read -rp "Deploy to production? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  warn "Skipping production deploy. Run manually: flyctl deploy --config fly.toml --app $PROD_APP"
  exit 0
fi

info "Deploying to production..."
flyctl deploy --config fly.toml --app "$PROD_APP" --remote-only

info "Verifying production health..."
sleep 5
PROD_URL="https://${PROD_DOMAIN}"
curl -sf "${PROD_URL}/health" && green "Production health check passed" || warn "Production health check failed — check fly logs"

# ── Step 10: Post-deploy verification ─────────────────────────
bold "Step 10: Post-deploy verification"

cat << 'VERIFY'

Manual verification checklist:
  □ https://devcomms.ai/          → API info JSON
  □ https://devcomms.ai/health     → { status: "ok" }
  □ https://devcomms.ai/health/ready → { status: "ready" }
  □ https://staging.devcomms.ai/health → { status: "ok" }
  □ flyctl logs --app devcomms-api         (production logs)
  □ flyctl logs --app devcomms-api-staging (staging logs)
  □ Set up UptimeRobot monitors (https://uptimerobot.com)
    - Monitor: https://devcomms.ai/health (5-min interval)
    - Monitor: https://staging.devcomms.ai/health (5-min interval)
  □ Add SENTRY_DSN for error tracking (if not already set)
  □ Review monthly cost in Fly.io dashboard → Billing

VERIFY

green "Provisioning complete!"
bold "Production: https://${PROD_DOMAIN}"
bold "Staging:   https://${STAGING_DOMAIN}"
