import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { APP_NAME, APP_VERSION, ApiSuccess } from '@dra/shared';
import apiRoutes from './routes/index.js';

// Extend Express Request to hold raw body for webhook verification
declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

// Sentry is optional — errors go to stdout when SENTRY_DSN is not set
let setupExpressErrorHandler: ((app: express.Express) => void) | null = null;

async function initSentry(): Promise<void> {
  if (!process.env.SENTRY_DSN) return;

  try {
    const Sentry = await import('@sentry/node');
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    Sentry.init({
      environment: process.env.NODE_ENV ?? 'development',
      release: `${APP_NAME}@${APP_VERSION}`,
      integrations: [Sentry.expressIntegration()],
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    } as Parameters<typeof Sentry.init>[0]);
    setupExpressErrorHandler = (app: express.Express) => {
      Sentry.setupExpressErrorHandler(app);
    };
    console.log('Sentry: enabled');
  } catch {
    console.warn('Sentry: failed to initialize — errors will go to stdout');
  }
}

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// ── Body parsing ───────────────────────────────────────────

// Capture raw body for webhook signature verification (before JSON parser)
app.use((req, _res, next) => {
  if (!req.url.startsWith('/api/github/webhook')) {
    next();
    return;
  }
  let data = '';
  req.on('data', (chunk: string) => {
    data += chunk;
  });
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
});

app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────

interface ApiInfo {
  name: string;
  version: string;
  environment: string;
  endpoints: string[];
}

app.get('/', (_req, res) => {
  const payload: ApiSuccess<ApiInfo> = {
    ok: true,
    data: {
      name: APP_NAME,
      version: APP_VERSION,
      environment: process.env.NODE_ENV ?? 'development',
      endpoints: ['/', '/health', '/health/ready'],
    },
  };
  res.json(payload);
});

// Basic liveness probe — always returns 200 if the process is running
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: APP_NAME,
    version: APP_VERSION,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ──────────────────────────────────────────────

app.use('/api', apiRoutes);

// Readiness probe — verifies downstream dependencies are configured
app.get('/health/ready', (_req, res) => {
  const checks: Record<string, { status: string }> = {};

  // Database check
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      new URL(dbUrl);
      checks.database = { status: 'configured' };
    } catch {
      checks.database = { status: 'misconfigured' };
    }
  } else {
    checks.database = { status: 'not_configured' };
  }

  // Redis check
  const redisUrl = process.env.REDIS_URL;
  checks.redis = redisUrl ? { status: 'configured' } : { status: 'not_configured' };

  const allAvailable = Object.values(checks).every(
    (c) => c.status === 'configured' || c.status === 'not_configured',
  );

  res.status(allAvailable ? 200 : 503).json({
    status: allAvailable ? 'ready' : 'degraded',
    app: APP_NAME,
    version: APP_VERSION,
    checks,
    timestamp: new Date().toISOString(),
  });
});

// ── Error handling ──────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

// ── Start ───────────────────────────────────────────────────

async function start(): Promise<void> {
  await initSentry();

  // Register Sentry error handler after routes, before other error middleware
  if (setupExpressErrorHandler) {
    setupExpressErrorHandler(app);
  }

  app.listen(port, () => {
    console.log(`${APP_NAME} v${APP_VERSION} running on http://localhost:${port.toString()}`);
    console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
  });
}

start().catch((err: unknown) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

export default app;
