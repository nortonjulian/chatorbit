import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import listEndpoints from 'express-list-endpoints';

import statusRoutes from './routes/status.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

export function createTestApp() {
  const app = express();

  app.use(cookieParser());
  app.use(express.json());
  app.use(helmet({ crossOriginEmbedderPolicy: false }));
  app.use(compression());
  app.use(cors({ origin: true, credentials: true }));

  const isLoad =
    process.env.NODE_ENV === 'loadtest' || process.env.LOADTEST === '1';
  const RL_HUGE = 100000;
  const statusReadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: isLoad ? RL_HUGE : 60,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // Enable status router when STATUS_ENABLED is set
  const STATUS_ENABLED =
    String(process.env.STATUS_ENABLED || '').toLowerCase() === 'true';
  if (STATUS_ENABLED) {
    app.use('/status', statusReadLimiter);
    app.use('/status', statusRoutes);
    // <<< deterministic signal for tests
    app.set('hasStatusRouter', true);
  }

  // Route dump for tests/dev assertions
  if (process.env.NODE_ENV !== 'production') {
    app.get('/__routes_dump', (_req, res) => {
      // nice-to-have listing
      const routes = listEndpoints(app)
        .flatMap((r) => (r.methods || []).map((m) => ({ method: m, path: r.path })))
        .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

      // source of truth: the flag we set at mount time
      let hasStatusRouter = app.get('hasStatusRouter') === true;

      // optional fallback: try to detect via stack if flag missing
      if (!hasStatusRouter) {
        const layers = app._router?.stack || [];
        const layerHasStatus = (layer) => {
          const src = layer?.regexp ? String(layer.regexp) : '';
          if (src.includes('^\\/status')) return true;
          if (layer?.route?.path && String(layer.route.path).startsWith('/status')) return true;
          const nested = [
            ...(layer?.handle?.stack || []),
            ...(layer?.route?.stack || []),
          ];
          return nested.some(layerHasStatus);
        };
        hasStatusRouter = layers.some(layerHasStatus);
      }

      res.json({
        statusFlag: String(process.env.STATUS_ENABLED || ''),
        hasStatusRouter,
        routes,
      });
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
