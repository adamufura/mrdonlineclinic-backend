import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import pinoHttp, { startTime } from 'pino-http';
import { logger, serializeError } from './logger';

function requestUrl(req: Request): string {
  return req.originalUrl || req.url || '';
}

function headerId(req: Request): string | undefined {
  const raw = req.headers['x-request-id'];
  const v = Array.isArray(raw) ? raw[0] : raw;
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length > 0 ? s : undefined;
}

function serializeHttpReq(req: Request) {
  return {
    id: req.id,
    method: req.method,
    url: requestUrl(req),
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
  };
}

function serializeHttpRes(res: Response) {
  const len = res.getHeader('content-length');
  return {
    statusCode: res.statusCode,
    contentLength: typeof len === 'number' || typeof len === 'string' ? len : undefined,
  };
}

export const httpLoggerMiddleware = pinoHttp<Request, Response>({
  logger,
  wrapSerializers: false,
  serializers: {
    req: serializeHttpReq,
    res: serializeHttpRes,
    err: serializeError,
  },
  genReqId(req, res) {
    const existing = headerId(req);
    if (existing) return existing;
    const id = randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customProps() {
    return { context: 'http' };
  },
  customLogLevel(_req, res, err) {
    if (err) return 'error';
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    if (res.statusCode >= 300 && res.statusCode < 400) return 'debug';
    return 'info';
  },
  customSuccessMessage(req, res, responseTime) {
    return `${req.method} ${requestUrl(req)} ${res.statusCode} ${responseTime}ms`;
  },
  customErrorMessage(req, res, err) {
    const started = res[startTime];
    const responseTime = typeof started === 'number' ? Date.now() - started : 0;
    return `${req.method} ${requestUrl(req)} ${res.statusCode} ${responseTime}ms — ${err.message}`;
  },
  autoLogging: {
    ignore(req: Request) {
      return req.method === 'OPTIONS';
    },
  },
});
