import { hash, verify } from '@node-rs/argon2';

// OWASP 2024 onerisi: argon2id, 19 MiB bellek, 2 tur, 1 paralellik
const options = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, options);
}

export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain, options);
  } catch {
    return false;
  }
}
