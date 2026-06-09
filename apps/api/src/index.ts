import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { APP_NAME, APP_VERSION, ApiSuccess } from '@dra/shared';

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(helmet());
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: APP_NAME, version: APP_VERSION });
});

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

app.listen(port, () => {
  console.log(`${APP_NAME} v${APP_VERSION} running on http://localhost:${port.toString()}`);
});

export default app;
