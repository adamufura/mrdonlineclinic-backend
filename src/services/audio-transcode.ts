import { PassThrough } from 'stream';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { logger } from '../config/logger';

// Point fluent-ffmpeg to the bundled binary
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

/**
 * Transcodes an audio buffer (webm, ogg, etc.) to mp4/aac format
 * which is universally playable on iOS, Android, and web.
 */
export function transcodeToMp4(inputBuffer: Buffer, _inputMime: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const inputStream = new PassThrough();
    inputStream.end(inputBuffer);

    const chunks: Buffer[] = [];
    const outputStream = new PassThrough();
    outputStream.on('data', (chunk: Buffer) => chunks.push(chunk));
    outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    outputStream.on('error', reject);

    ffmpeg(inputStream)
      .inputFormat('webm')
      .audioCodec('aac')
      .audioBitrate('128k')
      .audioChannels(1)
      .audioFrequency(44100)
      .format('mp4')
      .outputOptions('-movflags', 'frag_keyframe+empty_moov') // streaming-compatible mp4
      .on('error', (err) => {
        logger.warn({ err }, 'Audio transcode failed');
        reject(err);
      })
      .pipe(outputStream, { end: true });
  });
}
