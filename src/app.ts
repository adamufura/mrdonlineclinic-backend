import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { parseCorsOrigins } from './config/env';
import { API_PREFIX } from './config/constants';
import { httpLoggerMiddleware } from './config/httpLogger';
import { errorHandler } from './middlewares/errorHandler';
import { registerRoutes } from './routes';
import { ok } from './shared/envelope';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: parseCorsOrigins(),
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(mongoSanitize());
  app.use(httpLoggerMiddleware);

  app.get('/health', (req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    const io = req.app.locals.io;
    const socketClients = io && 'engine' in io ? (io as { engine: { clientsCount: number } }).engine.clientsCount : 0;
    res.json(
      ok('OK', {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database: dbUp ? 'up' : 'down',
        sockets: { clientsCount: socketClients },
      }),
    );
  });

  registerRoutes(app, API_PREFIX);

  app.use(errorHandler);

  return app;
}
