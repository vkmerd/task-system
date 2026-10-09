import { PrismaClient } from '@prisma/client';
import { isProd } from '../config/env.js';

export const prisma = new PrismaClient({
  log: isProd ? ['error'] : ['warn', 'error'],
});

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
