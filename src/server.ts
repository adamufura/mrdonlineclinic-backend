import http from 'http';
import './config/env';
import { createApp } from './app';
import { registerNotificationSubscribers } from './bootstrap/notification-subscriber';
import { runBootstrap } from './bootstrap/seed';
import { connectDb, disconnectDb } from './config/db';
import { getEnv } from './config/env';
import { logger } from './config/logger';
import { attachSockets } from './sockets';

async function bootstrap() {
  const env = getEnv();
  await connectDb();
  await runBootstrap();
  registerNotificationSubscribers();

  const app = createApp();
  const httpServer = http.createServer(app);

  const io = attachSockets(httpServer);
  app.locals.io = io;

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'HTTP server listening');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    io.close();
    await disconnectDb();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal bootstrap error');
  process.exit(1);
});
