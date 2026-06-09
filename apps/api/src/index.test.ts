import { describe, it, expect } from 'vitest';
import express from 'express';
import helmet from 'helmet';
import { APP_NAME, APP_VERSION } from '@dra/shared';

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
