import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';
import { resolvePermissions } from '../config/permissions.js';

/**
 * Access token'i dogrular ve req.user'i doldurur.
 * Yetkiler token'dan degil veritabanindan yeniden hesaplanir; boylece bir
 * kullanicinin yetkisi degistiginde token'in suresinin dolmasi beklenmez.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(unauthorized());
  }

  let sub: string;
  try {
    sub = verifyAccessToken(header.slice(7)).sub;
  } catch {
    return next(unauthorized('Oturum suresi doldu, lutfen tekrar giris yapin'));
  }

  const user = await prisma.user.findFirst({
    where: { id: sub, deletedAt: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      adminType: true,
      status: true,
      extraPermissions: true,
      deniedPermissions: true,
    },
  });

  if (!user) return next(unauthorized('Kullanici bulunamadi'));
  if (user.status === 'SUSPENDED') return next(unauthorized('Hesabiniz askiya alinmis'));

  req.user = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    adminType: user.adminType,
    permissions: resolvePermissions(user),
  };

  next();
}
