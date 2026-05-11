import pino from 'pino';

const nodeEnv = process.env.NODE_ENV ?? '';
const usePrettyTransport = !['production', 'test'].includes(nodeEnv);

/** Slim error shape for logs (avoids huge Mongoose topology blobs). Exported for pino-http. */
export function serializeError(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) {
    return { type: 'non-error', detail: typeof err === 'string' ? err : JSON.stringify(err) };
  }
  const out: Record<string, unknown> = {
    type: err.constructor.name,
    message: err.message,
    stack: err.stack,
  };
  const code = (err as NodeJS.ErrnoException).code;
  if (typeof code === 'string') {
    out.code = code;
  }
  const { cause } = err;
  if (cause instanceof Error) {
    out.cause = { type: cause.constructor.name, message: cause.message };
  }
  return out;
}

export const logger = pino({
  level: nodeEnv === 'production' ? 'info' : 'debug',
  ...(usePrettyTransport
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            colorizeObjects: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            levelFirst: true,
            singleLine: false,
            customColors: 'info:cyan,warn:yellow,error:red,fatal:magenta,debug:gray,trace:gray',
          },
        },
      }
    : {}),
  serializers: {
    err: serializeError,
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'password', 'passwordHash', 'token', 'refreshToken'],
    remove: true,
  },
});
