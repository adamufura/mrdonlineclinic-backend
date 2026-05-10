import mongoose from 'mongoose';
import { getEnv } from './env';
import { logger } from './logger';

export async function connectDb(): Promise<void> {
  const uri = getEnv().MONGODB_URI;
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  logger.info('MongoDB connected');
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
