import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { UPLOAD_DIR } from './db';
import { loadUser } from './auth';
import { HttpError, mailEnabled } from './services';
import { seedIfEmpty, COLLEGE_NAME } from './seed';
import { startScheduler } from './scheduler';
import { authRouter } from './routes/auth';
import { studentRouter } from './routes/student';
import { clubRouter } from './routes/club';
import { adminRouter } from './routes/admin';

const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

/** API-only app; main() adds the frontend (Vite in dev, ./dist in production). */
export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  // Posters and payment screenshots arrive as base64 data URLs (~1.37x their file size).
  app.use(express.json({ limit: '15mb' }));
  app.use(loadUser);

  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', fallthrough: false }));

  app.get('/api/meta', (_req, res) => res.json({ collegeName: COLLEGE_NAME, mailEnabled: mailEnabled(), showDemoAccounts: process.env.SHOW_DEMO_ACCOUNTS !== 'false' }));
  app.use('/api/auth', authRouter);
  app.use('/api/club', clubRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', studentRouter);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Upload is too large. Keep images under 5 MB.' });
    if (err?.status === 404) return res.status(404).end();
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
  });
  return app;
}

async function main() {
  if (await seedIfEmpty()) console.log('[db] seeded demo data');
  const app = createApp();
  const server = http.createServer(app);

  if (isProd) {
    const dist = path.resolve(process.cwd(), 'dist');
    app.use(express.static(dist, { index: false }));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    const { createServer } = await import('vite');
    // Live reload rides on the same port, so laptops on the network don't need a second port opened.
    const vite = await createServer({ server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  startScheduler();
  server.listen(PORT, '0.0.0.0', () => {
    const lan = Object.values(os.networkInterfaces())
      .flat()
      .filter(a => a && a.family === 'IPv4' && !a.internal)
      .map(a => `http://${a!.address}:${PORT}`);
    console.log(`\n  CampusPulse is running`);
    console.log(`  Local:    http://localhost:${PORT}`);
    for (const url of lan) console.log(`  Network:  ${url}`);
    console.log('');
  });
}

if (!process.env.CAMPUSPULSE_NO_LISTEN) {
  main().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
