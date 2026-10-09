import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL zorunlu (Neon connection string)'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().min(24, 'JWT_ACCESS_SECRET en az 24 karakter olmali'),
  JWT_REFRESH_SECRET: z.string().min(24, 'JWT_REFRESH_SECRET en az 24 karakter olmali'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@ajans.com'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('Admin123!'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`\n[env] Ortam degiskenleri hatali:\n${issues}\n\nserver/.env dosyasini .env.example'a gore doldurun.\n`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
