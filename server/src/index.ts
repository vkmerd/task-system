import { createApp } from './app.js';
import { env } from './config/env.js';
import { disconnectPrisma, prisma } from './lib/prisma.js';

async function main() {
  await prisma.$connect();
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`\n  API hazir  ->  http://localhost:${env.PORT}`);
    console.log(`  Ortam      ->  ${env.NODE_ENV}`);
    console.log(`  Panel      ->  ${env.CLIENT_URL}\n`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n[${signal}] kapatiliyor...`);
    server.close();
    await disconnectPrisma();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch(async (err) => {
  console.error('[boot] Sunucu baslatilamadi:', err);
  await disconnectPrisma();
  process.exit(1);
});
