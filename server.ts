import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { apiRouter } from './src/server/api.js';
import { db } from './src/server/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Immediate health check for Cloud Run and container orchestrator probes
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // Mount API endpoints
  app.use('/api', apiRouter);

  // Payload error handling middleware
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && (err.type === 'entity.too.large' || err.status === 413 || err.name === 'PayloadTooLargeError')) {
      return res.status(413).json({
        error: 'Upload payload is too large. Please select a photo smaller than 50MB.',
      });
    }
    next(err);
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(__dirname, 'dist');
  const distIndex = path.resolve(distPath, 'index.html');

  if (isProd && fs.existsSync(distIndex)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res, next) => {
      if (fs.existsSync(distIndex)) {
        res.sendFile(distIndex, (err) => {
          if (err) next(err);
        });
      } else {
        next();
      }
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // Bind to port immediately so Cloud Run health check passes unconditionally
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Driver Ping server listening on http://0.0.0.0:${PORT}`);
  });

  // Non-blocking database initialization in background
  db.waitForInit().catch((err: any) => {
    console.warn('⚠️ [Driver Ping DB] Non-fatal database initialization notice:', err?.message || err);
  });
}

startServer().catch((err) => {
  console.error('❌ [Server Startup Error]:', err);
});
