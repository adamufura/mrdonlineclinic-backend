import type { Request, Response } from 'express';
import type { Server } from 'socket.io';
import { AuthError, ValidationError } from '../../shared/errors';
import { ok } from '../../shared/envelope';
import { uploadBuffer } from '../../services/imagekit.service';
import * as svc from './chat.service';

export async function listRooms(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const result = await svc.listRoomsForUser(req.user.id, page, limit);
  return res.json(ok('Chat rooms', result.items, result.meta));
}

export async function getRoom(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.getRoomForUser(req.params.roomId, req.user.id);
  return res.json(ok('Chat room', data));
}

export async function markRoomReadAll(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.markRoomReadAll(req.params.roomId, req.user.id);
  return res.json(ok('Marked read', data));
}

export async function listMessages(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const { page, limit, before } = req.query as unknown as { page: number; limit: number; before?: Date };
  const result = await svc.listMessages(req.params.roomId, req.user.id, page, limit, before);
  return res.json(ok('Messages', result.items, result.meta));
}

export async function postMessage(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.createHttpMessage(req.params.roomId, req.user.id, req.body);
  const io = req.app.locals.io as Server | undefined;
  io?.of('/chat').to(req.params.roomId).emit('message', data);
  return res.status(201).json(ok('Message sent', data));
}

export async function markRead(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.markRead(req.params.roomId, req.params.messageId, req.user.id);
  return res.json(ok(data.message, data));
}

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_AUDIO_MIMES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/m4a', 'audio/mpeg', 'audio/wav'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10MB

export async function uploadAttachment(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  // Verify participant
  await svc.getRoomForUser(req.params.roomId, req.user.id);

  const file = req.file;
  if (!file) throw new ValidationError('No file uploaded');

  const mime = file.mimetype.toLowerCase();
  const isImage = ALLOWED_IMAGE_MIMES.includes(mime);
  const isAudio = ALLOWED_AUDIO_MIMES.includes(mime);

  if (!isImage && !isAudio) {
    throw new ValidationError('Unsupported file type. Allowed: images (jpg, png, webp, gif) and audio (webm, ogg, mp4, m4a, mpeg, wav)');
  }

  if (isImage && file.size > MAX_IMAGE_SIZE) {
    throw new ValidationError('Image must be under 5MB');
  }
  if (isAudio && file.size > MAX_AUDIO_SIZE) {
    throw new ValidationError('Audio must be under 10MB');
  }

  const folder = isImage ? '/chat/images' : '/chat/voice';
  const uploaded = await uploadBuffer({
    buffer: file.buffer,
    fileName: file.originalname || (isImage ? 'image.jpg' : 'voice-note.webm'),
    folder,
    mimeType: mime,
  });

  return res.status(201).json(ok('File uploaded', {
    url: uploaded.url,
    type: isImage ? 'image' : 'voice',
    fileName: file.originalname || (isImage ? 'image.jpg' : 'voice-note.webm'),
    mimeType: mime,
    size: file.size,
    duration: null,
  }));
}
