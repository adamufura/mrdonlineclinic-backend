import ImageKit from 'imagekit';
import path from 'path';
import { getEnv } from '../config/env';
import { logger } from '../config/logger';
import { AppError } from '../shared/errors';

/** Top-level ImageKit folder names (see .env.example). */
export const IMAGEKIT_ROOT = {
  patient: 'mrd_patient',
  practitioner: 'mrd_practitioner',
  prescriptions: 'mrd_prescriptions',
} as const;

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

/** e.g. /mrd_patient/{userId}/profile */
export function profilePhotoFolder(role: 'patients' | 'practitioners', userId: string): string {
  const root = role === 'patients' ? IMAGEKIT_ROOT.patient : IMAGEKIT_ROOT.practitioner;
  return `/${root}/${userId}/profile`;
}

/** e.g. /mrd_practitioner/{userId}/credentials */
export function practitionerCredentialsFolder(userId: string): string {
  return `/${IMAGEKIT_ROOT.practitioner}/${userId}/credentials`;
}

/** e.g. /mrd_prescriptions/{prescriptionId} */
export function prescriptionFolder(prescriptionId: string): string {
  return `/${IMAGEKIT_ROOT.prescriptions}/${prescriptionId}`;
}

function sanitizeFileName(name: string, fallbackExt = '.jpg'): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!base || base === '.' || base === '..') return `upload${fallbackExt}`;
  return base;
}

function extFromMime(mimeType?: string): string {
  if (!mimeType) return '.jpg';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return '.jpg';
  return '.jpg';
}

export async function deleteFileById(fileId: string | null | undefined): Promise<void> {
  if (!fileId?.trim()) return;
  try {
    const client = getClient();
    await client.deleteFile(fileId);
  } catch (err) {
    logger.warn({ err, fileId }, 'ImageKit deleteFile failed (continuing)');
  }
}

export async function uploadBuffer(options: {
  buffer: Buffer;
  fileName: string;
  folder: string;
  mimeType?: string;
  useUniqueFileName?: boolean;
}): Promise<{ url: string; fileId: string; filePath: string }> {
  const client = getClient();
  const ext = extFromMime(options.mimeType);
  const safeName = sanitizeFileName(options.fileName, ext);
  const res = await client.upload({
    file: options.buffer,
    fileName: safeName.endsWith(ext) ? safeName : `${safeName.replace(/\.[^.]+$/, '')}${ext}`,
    folder: options.folder,
    useUniqueFileName: options.useUniqueFileName ?? true,
  });
  return { url: res.url, fileId: res.fileId, filePath: res.filePath };
}

/** Upload profile photo to role/user folder and remove previous ImageKit asset when present. */
export async function uploadProfilePhoto(options: {
  role: 'patients' | 'practitioners';
  userId: string;
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
  previousFileId?: string | null;
}): Promise<{ url: string; fileId: string }> {
  await deleteFileById(options.previousFileId);
  const uploaded = await uploadBuffer({
    buffer: options.buffer,
    fileName: options.fileName,
    folder: profilePhotoFolder(options.role, options.userId),
    mimeType: options.mimeType,
    useUniqueFileName: true,
  });
  return { url: uploaded.url, fileId: uploaded.fileId };
}
