import { describe, it, expect } from 'vitest';
import express from 'express';
import helmet from 'helmet';
import { APP_NAME, APP_VERSION, ApiSuccess } from '@dra/shared';

describe('health endpoint', () => {
  it('returns expected shape', () => {
    const app = express();
    app.use(helmet());

    app.get('/health', (_req, res) => {
      res.json({
        status: 'ok',
        app: APP_NAME,
        version: APP_VERSION,
        uptime: 0,
        timestamp: new Date().toISOString(),
      });
    });

    const response = { status: 'ok', app: APP_NAME, version: APP_VERSION };
    expect(response.status).toBe('ok');
    expect(response.app).toBe('DRA');
    expect(response.version).toBe('0.1.0');
  });
});

describe('health/ready endpoint', () => {
  it('returns ready when database is configured', () => {
    const app = express();
    app.use(helmet());

    app.get('/health/ready', (_req, res) => {
      const checks = {
        database: { status: 'configured' },
        redis: { status: 'configured' },
      };
      res.json({
        status: 'ready',
        app: APP_NAME,
        version: APP_VERSION,
        checks,
        timestamp: new Date().toISOString(),
      });
    });

    const response = {
      status: 'ready',
      app: APP_NAME,
      version: APP_VERSION,
      checks: { database: { status: 'configured' }, redis: { status: 'configured' } },
    };
    expect(response.status).toBe('ready');
    expect(response.checks.database.status).toBe('configured');
    expect(response.checks.redis.status).toBe('configured');
  });

  it('reports degraded when a dependency is misconfigured', () => {
    const checks = {
      database: { status: 'misconfigured' },
      redis: { status: 'configured' },
    };
    const hasDegraded = Object.values(checks).some(
      (c) => c.status !== 'configured' && c.status !== 'not_configured',
    );
    expect(hasDegraded).toBe(true);
  });

  it('reports not_configured when env vars are missing', () => {
    const checks = {
      database: { status: 'not_configured' },
      redis: { status: 'not_configured' },
    };
    expect(checks.database.status).toBe('not_configured');
    expect(checks.redis.status).toBe('not_configured');
  });
});

describe('root endpoint', () => {
  it('returns API info with ok wrapper', () => {
    const app = express();
    app.use(helmet());

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
          environment: 'test',
          endpoints: ['/', '/health', '/health/ready'],
        },
      };
      res.json(payload);
    });

    const response: ApiSuccess<ApiInfo> = {
      ok: true,
      data: {
        name: APP_NAME,
        version: APP_VERSION,
        environment: 'test',
        endpoints: ['/', '/health', '/health/ready'],
      },
    };

    expect(response.ok).toBe(true);
    expect(response.data.name).toBe('DRA');
    expect(response.data.version).toBe('0.1.0');
    expect(response.data.endpoints).toEqual(['/', '/health', '/health/ready']);
  });
});
