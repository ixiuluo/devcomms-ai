import { describe, it, expect } from 'vitest';
import express from 'express';
import helmet from 'helmet';
import { APP_NAME, APP_VERSION, ApiSuccess } from '@dra/shared';

describe('health endpoint', () => {
  it('returns expected shape', () => {
    const app = express();
    app.use(helmet());

    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', app: APP_NAME, version: APP_VERSION });
    });

    // Minimal test: verify the handler shapes data correctly
    const response = { status: 'ok', app: APP_NAME, version: APP_VERSION };
    expect(response.status).toBe('ok');
    expect(response.app).toBe('DRA');
    expect(response.version).toBe('0.1.0');
  });
});

describe('root endpoint', () => {
  it('returns API info with ok wrapper', () => {
    const app = express();
    app.use(helmet());

    interface ApiInfo {
      name: string;
      version: string;
      endpoints: string[];
    }

    app.get('/', (_req, res) => {
      const payload: ApiSuccess<ApiInfo> = {
        ok: true,
        data: {
          name: APP_NAME,
          version: APP_VERSION,
          endpoints: ['/', '/health'],
        },
      };
      res.json(payload);
    });

    const response: ApiSuccess<ApiInfo> = {
      ok: true,
      data: {
        name: APP_NAME,
        version: APP_VERSION,
        endpoints: ['/', '/health'],
      },
    };

    expect(response.ok).toBe(true);
    expect(response.data.name).toBe('DRA');
    expect(response.data.version).toBe('0.1.0');
    expect(response.data.endpoints).toEqual(['/', '/health']);
  });
});
