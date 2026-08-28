import pino, { type Logger } from 'pino';
import { env } from '../../config/env.js';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.accessToken',
];

export function createLogger(): Logger {
  return pino({
    level: env.LOG_LEVEL,
    redact: {
      paths: redactPaths,
      censor: '[REDACTED]',
    },
    base: { service: 'order-management-api', env: env.NODE_ENV },
    timestamp: pino.stdTimeFunctions.isoTime,
    transport:
      env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: { colorize: true, singleLine: false, translateTime: 'HH:MM:ss.l' },
          }
        : undefined,
  });
}

export const logger: Logger = createLogger();
