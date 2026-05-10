/**
 * One-off: connect to MongoDB, run bootstrap seeders, disconnect, exit.
 * Usage: npm run seed
 */
import '../config/env';
import { runBootstrap } from '../bootstrap/seed';
import { connectDb, disconnectDb } from '../config/db';
import { logger } from '../config/logger';

async function main() {
  await connectDb();
  await runBootstrap();
  await disconnectDb();
  logger.info('Seed run finished');
}

main().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
