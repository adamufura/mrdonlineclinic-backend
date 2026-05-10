import ImageKit from 'imagekit';
import { getEnv } from '../config/env';
import { AppError } from '../shared/errors';

function getClient(): ImageKit {
  const env = getEnv();
  if (!env.IMAGEKIT_PUBLIC_KEY || !env.IMAGEKIT_PRIVATE_KEY || !env.IMAGEKIT_URL_ENDPOINT) {
    throw new AppError('File storage is not configured', 503);
  }
  return new ImageKit({
    publicKey: env.IMAGEKIT_PUBLIC_KEY,
    privateKey: env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: env.IMAGEKIT_URL_ENDPOINT,
  });
}

export async function uploadBuffer(options: {
  buffer: Buffer;
  fileName: string;
  folder: string;
  mimeType?: string;
}): Promise<{ url: string; fileId: string }> {
  const client = getClient();
  const res = await client.upload({
    file: options.buffer,
    fileName: options.fileName,
    folder: options.folder,
    useUniqueFileName: true,
  });
  return { url: res.url, fileId: res.fileId };
}
