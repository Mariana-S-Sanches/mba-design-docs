import { buildApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/database.js';
import { logger } from './shared/logger/index.js';

async function bootstrap(): Promise<void> {
  const app = buildApp({ prisma });

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'server_started');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutdown_initiated');
    server.close(() => logger.info('http_server_closed'));
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'bootstrap_failed');
  process.exit(1);
});
