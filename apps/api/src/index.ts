import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { APP_NAME, APP_VERSION } from '@dra/shared';

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(helmet());
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: APP_NAME, version: APP_VERSION });
});

app.listen(port, () => {
  console.log(`${APP_NAME} v${APP_VERSION} running on http://localhost:${port.toString()}`);
});

export default app;
